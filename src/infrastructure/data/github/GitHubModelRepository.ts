import type {
  CanonicalModel,
  Provider,
  Offering,
  RankingEntry,
  ChangesFeed,
  Benchmark,
} from '../../../schemas/api';
import {
  CanonicalModelsResponseSchema,
  ProvidersResponseSchema,
  OfferingsResponseSchema,
  RankingResponseSchema,
  ChangesFeedSchema,
  BenchmarksResponseSchema,
} from '../../../schemas/api';
import type { ModelRepository, CachedData } from '../../../domain/models';

export type { CachedData } from '../../../domain/models';

export const API_BASE = 'https://raw.githubusercontent.com/ngodingsendiri/BaseModel/main/dist';
export const CDN_FALLBACK = 'https://cdn.jsdelivr.net/gh/ngodingsendiri/BaseModel@main/dist';

export const CACHE_KEY = 'basemodel:explorer-data:v5';
export const CACHE_TTL = 10 * 60 * 1000;

export const MAX_FAILURES_BEFORE_CIRCUIT_OPEN = 5;
export const CIRCUIT_RESET_TIMEOUT = 60 * 1000;
export const MIN_REQUEST_INTERVAL = 30 * 1000;

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY = 1000;

export interface GitHubModelRepositoryOptions {
  /** Minimum delay between network requests in ms. Pass 0 to disable (tests). */
  minRequestInterval?: number;
  /** Number of retries per URL before falling back to the next mirror. */
  maxRetries?: number;
  /** Base exponential backoff delay in ms for retries. */
  retryBaseDelay?: number;
}

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/+$/, '');
}

export class GitHubModelRepository implements ModelRepository {
  private controller = new AbortController();
  private circuitFailureCount = 0;
  private circuitOpenedAt = 0;
  private lastRequestTime = 0;
  private readonly minRequestInterval: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelay: number;
  private readonly mirrors: string[];

  constructor(options: GitHubModelRepositoryOptions = {}) {
    this.minRequestInterval = options.minRequestInterval ?? MIN_REQUEST_INTERVAL;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelay = options.retryBaseDelay ?? DEFAULT_RETRY_BASE_DELAY;

    // Additional independent mirrors can be supplied at build time
    // (e.g. VITE_DATA_MIRRORS="https://r2.example.com/base,https://s3.example.com/base").
    const envMirrors = (import.meta.env.VITE_DATA_MIRRORS as string | undefined)
      ?.split(',')
      .map((m) => m.trim())
      .filter(Boolean) ?? [];
    this.mirrors = [API_BASE, CDN_FALLBACK, ...envMirrors];
  }

  abort(): void {
    this.controller.abort();
    this.controller = new AbortController();
  }

  isCircuitOpen(): boolean {
    if (this.circuitFailureCount < MAX_FAILURES_BEFORE_CIRCUIT_OPEN) return false;
    if (Date.now() - this.circuitOpenedAt > CIRCUIT_RESET_TIMEOUT) {
      this.circuitFailureCount = 0;
      return false;
    }
    return true;
  }

  resetCircuitBreaker(): void {
    this.circuitFailureCount = 0;
    this.circuitOpenedAt = 0;
    this.lastRequestTime = 0;
  }

  getCachedData(ignoreTTL = false): CachedData | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedData;
      // Shape guard: a corrupt or foreign-shape cache must never reach render.
      if (!Array.isArray(parsed?.data?.models) || !Array.isArray(parsed?.data?.offerings)) return null;
      if (!ignoreTTL && Date.now() - parsed.timestamp > CACHE_TTL) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  writeCache(payload: CachedData): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }

  async fetchCanonicalModels(): Promise<CanonicalModel[]> {
    const data = await this.fetchJson('v2/models.json');
    const result = CanonicalModelsResponseSchema.safeParse(data);
    if (!result.success) throw new Error(`Invalid models: ${result.error.message}`);
    return result.data.models;
  }

  async fetchProviders(): Promise<Provider[]> {
    const data = await this.fetchJson('providers.json');
    const result = ProvidersResponseSchema.safeParse(data);
    if (!result.success) throw new Error(`Invalid providers: ${result.error.message}`);
    return result.data.providers;
  }

  async fetchOfferings(): Promise<Offering[]> {
    const data = await this.fetchJson('v2/offerings.json');
    const result = OfferingsResponseSchema.safeParse(data);
    if (!result.success) throw new Error(`Invalid offerings: ${result.error.message}`);
    return result.data.offerings;
  }

  async fetchRanking(): Promise<RankingEntry[]> {
    const data = await this.fetchJson('v2/intelligence.json');
    const result = RankingResponseSchema.safeParse(data);
    if (!result.success) throw new Error(`Invalid ranking: ${result.error.message}`);
    return result.data.ranking;
  }

  async fetchChanges(): Promise<ChangesFeed> {
    const data = await this.fetchJson('changes.json');
    const result = ChangesFeedSchema.safeParse(data);
    if (!result.success) throw new Error(`Invalid changes: ${result.error.message}`);
    return result.data;
  }

  async fetchBenchmarks(): Promise<Benchmark[]> {
    const data = await this.fetchJson('benchmarks.json');
    const result = BenchmarksResponseSchema.safeParse(data);
    if (!result.success) throw new Error(`Invalid benchmarks: ${result.error.message}`);
    return result.data.benchmarks;
  }

  private async fetchJson(filename: string): Promise<unknown> {
    if (this.isCircuitOpen()) {
      throw new Error('Circuit breaker open - too many failures. Please wait before retrying.');
    }

    await this.enforceRateLimit();

    let lastError: Error | null = null;
    for (const base of this.mirrors) {
      const url = `${normalizeBaseUrl(base)}/${filename}`;
      try {
        const response = await this.fetchWithRetry(url);
        this.recordSuccess();
        return await response.json();
      } catch (err) {
        if (this.isAbortError(err)) throw err;
        lastError = err as Error;
      }
    }

    this.recordFailure();
    throw lastError ?? new Error(`Failed to fetch ${filename}`);
  }

  private async fetchWithTimeout(url: string, signal: AbortSignal, timeout = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const abortHandler = () => controller.abort();
    signal.addEventListener('abort', abortHandler);
    return fetch(url, { signal: controller.signal }).finally(() => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', abortHandler);
    });
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: Error;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, this.controller.signal);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response;
      } catch (err) {
        if (this.isAbortError(err)) throw err;
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          const delay = this.retryBaseDelay * Math.pow(2, attempt) + Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError!;
  }

  private async enforceRateLimit(): Promise<void> {
    if (this.minRequestInterval <= 0) return;
    // Only throttle under failure pressure (e.g. repeated retries), so healthy
    // parallel loads are never delayed.
    if (this.circuitFailureCount === 0) return;
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private recordFailure(): void {
    this.circuitFailureCount++;
    if (this.circuitFailureCount >= MAX_FAILURES_BEFORE_CIRCUIT_OPEN) {
      this.circuitOpenedAt = Date.now();
    }
  }

  private recordSuccess(): void {
    this.circuitFailureCount = 0;
  }

  private isAbortError(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'AbortError';
  }
}

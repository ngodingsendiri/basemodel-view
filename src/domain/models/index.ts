import type {
  CanonicalModel,
  Provider,
  Offering,
  ExplorerData,
  RankingEntry,
  ChangesFeed,
  Benchmark,
} from '../../schemas/api';

export interface ModelRepository {
  fetchCanonicalModels(): Promise<CanonicalModel[]>;
  fetchProviders(): Promise<Provider[]>;
  fetchOfferings(): Promise<Offering[]>;
  fetchRanking(): Promise<RankingEntry[]>;
  fetchChanges(): Promise<ChangesFeed>;
  fetchBenchmarks(): Promise<Benchmark[]>;
  /**
   * Returns a cached payload, or null when empty. When `ignoreTTL` is true,
   * stale (expired) cache is returned too — used to seed the UI immediately
   * while a background refresh runs (stale-while-revalidate).
   */
  getCachedData(ignoreTTL?: boolean): CachedData | null;
  /** Persists a payload to the local cache (best-effort). */
  writeCache(payload: CachedData): void;
  isCircuitOpen(): boolean;
  resetCircuitBreaker(): void;
  abort(): void;
}

export interface CachedData {
  data: ExplorerData;
  ranking: RankingEntry[];
  changes: ChangesFeed | null;
  benchmarkRecords: Benchmark[];
  timestamp: number;
}

export interface ModelService {
  getExplorerData(): Promise<ExplorerData>;
  getRanking(): Promise<RankingEntry[]>;
  getChanges(): Promise<ChangesFeed>;
  getBenchmarkRecords(): Promise<Benchmark[]>;
}

import type { Model, Provider, ExplorerData, IntelligenceRecord } from '../../schemas/api';

export interface ModelRepository {
  fetchModels(): Promise<Model[]>;
  fetchProviders(): Promise<Provider[]>;
  fetchIntelligence(): Promise<IntelligenceRecord[]>;
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
  intelligenceRecords: IntelligenceRecord[];
  timestamp: number;
}

export interface ModelService {
  getExplorerData(): Promise<ExplorerData>;
  getIntelligenceRecords(): Promise<IntelligenceRecord[]>;
}
import type { Model, Provider, ExplorerData, IntelligenceRecord } from '../../schemas/api';
import type { ModelId, ProviderId } from '../branded';
import type { SortKey } from '../../types/filters';

export interface ModelRepository {
  fetchModels(): Promise<Model[]>;
  fetchProviders(): Promise<Provider[]>;
  fetchIntelligence(): Promise<IntelligenceRecord[]>;
  /** Returns a fresh cached payload, or null when the cache is empty/expired. */
  getCachedData(): CachedData | null;
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
  filterModels(
    models: Model[],
    intelligence: IntelligenceRecord[],
    options: FilterOptions
  ): FilteredResult;
}

export interface FilterOptions {
  providerId?: ProviderId;
  freeOnly?: boolean;
  searchQuery?: string;
  sortKey?: SortKey;
}

export interface FilteredResult {
  models: Model[];
  getTier: (modelId: ModelId) => string;
}

export const TIER_PRIORITY: Record<string, number> = {
  Free: 0,
  'Budget-Friendly': 1,
  Balanced: 2,
  Premium: 3,
  Unknown: 4,
};

export function sortModels(models: Model[], sortKey: SortKey): Model[] {
  const sorted = [...models];
  switch (sortKey) {
    case 'context':
      return sorted.sort((a, b) => (b.context_window ?? 0) - (a.context_window ?? 0));
    case 'date':
      return sorted.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}
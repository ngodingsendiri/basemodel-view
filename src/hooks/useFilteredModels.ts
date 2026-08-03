import { useMemo, useCallback } from 'react';
import type { Model, Provider, IntelligenceRecord, BenchmarkScore } from '../schemas/api';
import type { ModelId } from '../domain/branded';
import type { SortKey, ProviderFilter } from '../types/filters';
import { rankBenchmarkFromKey } from '../types/filters';

export interface UseFilteredModelsProps {
  models: Model[];
  providers: Provider[];
  intelligenceByModel: ReadonlyMap<ModelId, IntelligenceRecord>;
  /** catalog model id -> benchmark name -> { score, rank }. */
  benchmarksByModel?: ReadonlyMap<ModelId, ReadonlyMap<string, BenchmarkScore>>;
  selectedProviderId: ProviderFilter;
  searchQuery: string;
  freeOnly: boolean;
  sortKey: SortKey;
}

export function useFilteredModels({
  models,
  providers,
  intelligenceByModel,
  benchmarksByModel = new Map(),
  selectedProviderId,
  searchQuery,
  freeOnly,
  sortKey,
}: UseFilteredModelsProps) {
  const tierMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [modelId, record] of intelligenceByModel) {
      map.set(modelId, record.cost_tier);
    }
    return map;
  }, [intelligenceByModel]);

  const getTierForModel = useCallback(
    (modelId: string) => tierMap.get(modelId) ?? 'Unknown',
    [tierMap]
  );

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const [modelId, record] of intelligenceByModel) {
      map.set(modelId, record.blended_cost_per_1m);
    }
    return map;
  }, [intelligenceByModel]);

  const getPriceForModel = useCallback(
    (modelId: string) => priceMap.get(modelId),
    [priceMap]
  );

  /** Score for a model on a benchmark, or undefined when unranked. */
  const getBenchmarkScore = useCallback(
    (modelId: string, name: string): BenchmarkScore | undefined =>
      benchmarksByModel.get(modelId as ModelId)?.get(name),
    [benchmarksByModel]
  );

  const rankBenchmark = rankBenchmarkFromKey(sortKey);

  const filtered = useMemo(() => {
    let result = models;

    if (selectedProviderId !== 'all') {
      result = result.filter((m) => m.provider_id === selectedProviderId);
    }
    if (freeOnly) {
      result = result.filter((m) => getTierForModel(m.model_id) === 'Free');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const providerNameById = new Map(providers.map((p) => [p.provider_id, p.name.toLowerCase()]));
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.model_id.toLowerCase().includes(q) ||
          (providerNameById.get(m.provider_id) ?? '').includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortKey === 'context') return (b.context_window ?? 0) - (a.context_window ?? 0);
      if (sortKey === 'date') return (b.release_date ?? '').localeCompare(a.release_date ?? '');
      if (sortKey === 'price') {
        const pa = priceMap.get(a.model_id) ?? Number.POSITIVE_INFINITY;
        const pb = priceMap.get(b.model_id) ?? Number.POSITIVE_INFINITY;
        return pa - pb;
      }
      if (rankBenchmark) {
        const sa = benchmarksByModel.get(a.model_id)?.get(rankBenchmark)?.score;
        const sb = benchmarksByModel.get(b.model_id)?.get(rankBenchmark)?.score;
        // Unranked models sink to the bottom; among ranked, higher score first.
        if (sa == null && sb == null) return 0;
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sb - sa;
      }
      return a.name.localeCompare(b.name);
    });
  }, [models, providers, selectedProviderId, searchQuery, freeOnly, sortKey, getTierForModel, priceMap, benchmarksByModel, rankBenchmark]);

  return { filtered, getTierForModel, getPriceForModel, getBenchmarkScore, rankBenchmark };
}

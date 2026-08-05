import { useMemo, useCallback } from 'react';
import type { CanonicalModel, Provider, Offering, BenchmarkScore, RankingEntry } from '../schemas/api';
import type { ModelId, ProviderId } from '../domain/branded';
import type { SortKey, ProviderFilter } from '../types/filters';
import { rankBenchmarkFromKey } from '../types/filters';
import type { ModelPricing } from './useExplorerData';

export interface UseFilteredModelsProps {
  models: CanonicalModel[];
  providers: Provider[];
  offeringsByModel: ReadonlyMap<ModelId, Offering[]>;
  pricingByModel: ReadonlyMap<ModelId, ModelPricing>;
  modelIdsByProvider: ReadonlyMap<ProviderId, ReadonlySet<ModelId>>;
  rankingByModel: ReadonlyMap<ModelId, RankingEntry>;
  /** catalog model id -> benchmark name -> { score, rank } */
  benchmarksByModel?: ReadonlyMap<ModelId, ReadonlyMap<string, BenchmarkScore>>;
  selectedProviderId: ProviderFilter;
  searchQuery: string;
  freeOnly: boolean;
  sortKey: SortKey;
}

export function useFilteredModels({
  models,
  providers,
  offeringsByModel,
  pricingByModel,
  modelIdsByProvider,
  rankingByModel,
  benchmarksByModel = new Map(),
  selectedProviderId,
  searchQuery,
  freeOnly,
  sortKey,
}: UseFilteredModelsProps) {
  const getTierForModel = useCallback(
    (modelId: string) => pricingByModel.get(modelId as ModelId)?.tier ?? 'Unknown',
    [pricingByModel]
  );

  const getPriceForModel = useCallback(
    (modelId: string) => pricingByModel.get(modelId as ModelId)?.price,
    [pricingByModel]
  );

  const getOfferingsForModel = useCallback(
    (modelId: string): Offering[] => offeringsByModel.get(modelId as ModelId) ?? [],
    [offeringsByModel]
  );

  const getProviderCount = useCallback(
    (modelId: string) => offeringsByModel.get(modelId as ModelId)?.length ?? 0,
    [offeringsByModel]
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
      const served = modelIdsByProvider.get(selectedProviderId);
      result = result.filter((m) => served?.has(m.model_id));
    }
    if (freeOnly) {
      result = result.filter((m) => getTierForModel(m.model_id) === 'Free');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const providerNameById = new Map(providers.map((p) => [p.provider_id, p.name.toLowerCase()]));
      // Provider names serving each model, precomputed once per query pass.
      const providerNamesByModel = new Map<ModelId, string>();
      for (const m of models) {
        const names = (offeringsByModel.get(m.model_id) ?? [])
          .map((o) => providerNameById.get(o.provider_id) ?? '')
          .join(' ');
        providerNamesByModel.set(m.model_id, names);
      }
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.model_id.toLowerCase().includes(q) ||
          m.aliases.some((alias) => alias.toLowerCase().includes(q)) ||
          (providerNamesByModel.get(m.model_id) ?? '').includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortKey === 'context') return (b.context_window ?? 0) - (a.context_window ?? 0);
      if (sortKey === 'date') return (b.release_date ?? '').localeCompare(a.release_date ?? '');
      if (sortKey === 'price') {
        const pa = pricingByModel.get(a.model_id)?.price ?? Number.POSITIVE_INFINITY;
        const pb = pricingByModel.get(b.model_id)?.price ?? Number.POSITIVE_INFINITY;
        return pa - pb;
      }
      if (sortKey === 'quality') {
        const qa = a.quality?.score;
        const qb = b.quality?.score;
        // Unscored models sink to the bottom; among scored, higher first.
        if (qa == null && qb == null) return 0;
        if (qa == null) return 1;
        if (qb == null) return -1;
        return qb - qa;
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
  }, [models, providers, selectedProviderId, searchQuery, freeOnly, sortKey, modelIdsByProvider, getTierForModel, pricingByModel, offeringsByModel, benchmarksByModel, rankBenchmark]);

  return {
    filtered,
    getTierForModel,
    getPriceForModel,
    getOfferingsForModel,
    getProviderCount,
    getBenchmarkScore,
    rankBenchmark,
    rankingByModel,
  };
}

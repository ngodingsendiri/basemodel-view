import { useMemo, useCallback } from 'react';
import type { Model, IntelligenceRecord } from '../schemas/api';
import type { ModelId } from '../domain/branded';
import type { SortKey, ProviderFilter } from '../types/filters';

interface UseFilteredModelsProps {
  models: Model[];
  intelligenceByModel: ReadonlyMap<ModelId, IntelligenceRecord>;
  selectedProviderId: ProviderFilter;
  searchQuery: string;
  freeOnly: boolean;
  sortKey: SortKey;
}

export function useFilteredModels({
  models,
  intelligenceByModel,
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
      result = result.filter(
        (m) => m.name.toLowerCase().includes(q) || m.model_id.toLowerCase().includes(q)
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
      return a.name.localeCompare(b.name);
    });
  }, [models, selectedProviderId, searchQuery, freeOnly, sortKey, getTierForModel, priceMap]);

  return { filtered, getTierForModel, getPriceForModel };
}

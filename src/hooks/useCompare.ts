import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Model } from '../schemas/api';
import type { ModelId } from '../domain/branded';

export function useCompare(models: Model[], urlSeed: ModelId[] = []) {
  const [selected, setSelected] = useState<ReadonlySet<ModelId>>(new Set());

  const toggle = useCallback((modelId: string) => {
    const id = modelId as ModelId;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  // Apply the URL seed once the dataset is available. Selections that do not
  // reference a known model are dropped.
  const appliedSeedRef = useRef(false);
  useEffect(() => {
    if (appliedSeedRef.current) return;
    if (models.length === 0) return;
    appliedSeedRef.current = true;
    const known = new Set(models.map((m) => m.model_id));
    const seed = new Set<ModelId>(urlSeed.filter((id) => known.has(id)));
    if (seed.size > 0) setSelected(seed);
  }, [models, urlSeed]);

  // Keep only models that still exist in the current dataset, so stale
  // selections (e.g. after a data refresh) never linger in state or the URL.
  useEffect(() => {
    const known = new Set(models.map((m) => m.model_id));
    setSelected((prev) => {
      const next = new Set<ModelId>();
      for (const id of prev) if (known.has(id)) next.add(id);
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [models]);

  const selectedModels = useMemo(
    () => models.filter((m) => selected.has(m.model_id)),
    [models, selected]
  );

  return { selected, toggle, clear, selectedModels };
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanonicalModel } from '../schemas/api';
import type { ModelId } from '../domain/branded';

import { MAX_COMPARE } from '../components/ui/constants';

export function useCompare(models: CanonicalModel[], urlSeed: ModelId[] = []) {
  const [selected, setSelected] = useState<ReadonlySet<ModelId>>(new Set());
  // State (not just a ref) so consumers re-render once the seed is evaluated.
  const [seedApplied, setSeedApplied] = useState(false);

  const toggle = useCallback((modelId: string) => {
    const id = modelId as ModelId;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Respect the comparison cap; removing stays allowed.
        if (prev.size >= MAX_COMPARE) return prev;
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  // Apply the URL seed once the dataset is available. Selections that do not
  // reference a known model are dropped. `appliedSeedRef` doubles as a flag
  // for callers: while a seed is still pending, the URL `compare` param must
  // not be rewritten (it would be wiped before the seed can read it).
  const appliedSeedRef = useRef(false);
  useEffect(() => {
    if (appliedSeedRef.current) return;
    if (models.length === 0) return;
    appliedSeedRef.current = true;
    const known = new Set(models.map((m) => m.model_id));
    const seed = new Set<ModelId>(urlSeed.filter((id) => known.has(id)).slice(0, MAX_COMPARE));
    if (seed.size > 0) setSelected(seed);
    setSeedApplied(true);
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

  return {
    selected,
    toggle,
    clear,
    selectedModels,
    /** False until the URL seed has been evaluated against the dataset. */
    seedApplied,
    isFull: selected.size >= MAX_COMPARE,
    maxCompare: MAX_COMPARE,
  };
}

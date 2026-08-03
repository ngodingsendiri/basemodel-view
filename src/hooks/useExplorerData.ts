import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IntelligenceRecord, ExplorerData } from '../schemas/api';
import type { ModelId, ProviderId } from '../domain/branded';
import { useModelRepository, useModelService } from '../context/modelRegistry/useModelRegistry';
import { reportError } from '../utils/errorReporting';

export interface ExplorerDataState {
  data: ExplorerData | null;
  intelligenceRecords: IntelligenceRecord[];
  error: string | null;
  loading: boolean;
  lastUpdated: number | null;
  retryCount: number;
  retry: () => void;
  modelsById: ReadonlyMap<ModelId, ExplorerData['models'][number]>;
  intelligenceByModel: ReadonlyMap<ModelId, IntelligenceRecord>;
  providerCounts: ReadonlyMap<ProviderId, number>;
}

export function useExplorerData(): ExplorerDataState {
  const service = useModelService();
  const repository = useModelRepository();

  const [data, setData] = useState<ExplorerData | null>(null);
  const [intelligenceRecords, setIntelligenceRecords] = useState<IntelligenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Tracks whether we currently have data to render (live or stale), so a
  // background refresh failure never blanks the UI.
  const hasDataRef = useRef(false);
  useEffect(() => {
    if (data) hasDataRef.current = true;
  }, [data]);

  const modelsById = useMemo(() => {
    const map = new Map<ModelId, ExplorerData['models'][number]>();
    for (const model of data?.models ?? []) {
      map.set(model.model_id, model);
    }
    return map;
  }, [data]);

  const intelligenceByModel = useMemo(() => {
    const map = new Map<ModelId, IntelligenceRecord>();
    for (const record of intelligenceRecords) {
      map.set(record.model_id, record);
    }
    return map;
  }, [intelligenceRecords]);

  const providerCounts = useMemo(() => {
    const counts = new Map<ProviderId, number>();
    for (const model of data?.models ?? []) {
      counts.set(model.provider_id, (counts.get(model.provider_id) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const loadData = useCallback(async (isRetry = false) => {
    if (repository.isCircuitOpen()) {
      setError('Too many failed requests. Please wait before retrying.');
      setLoading(false);
      return;
    }

    try {
      if (isRetry) setLoading(true);
      setError(null);

      // Graceful degradation: models + providers are required, intelligence is
      // optional. An intelligence failure keeps the catalog usable.
      const [explorerResult, intelResult] = await Promise.allSettled([
        service.getExplorerData(),
        service.getIntelligenceRecords(),
      ]);

      if (explorerResult.status === 'rejected') {
        throw explorerResult.reason;
      }

      const explorerData = explorerResult.value;
      const knownModelIds = new Set(explorerData.models.map((m) => m.model_id));

      let validIntel: IntelligenceRecord[] = [];
      if (intelResult.status === 'fulfilled') {
        validIntel = intelResult.value.filter((i) => knownModelIds.has(i.model_id));
      } else {
        // Intelligence unavailable: keep any records still referencing known
        // models so the catalog degrades gracefully.
        reportError(intelResult.reason);
        setIntelligenceRecords((prev) => prev.filter((i) => knownModelIds.has(i.model_id)));
      }

      setData(explorerData);
      setIntelligenceRecords(validIntel);
      setLastUpdated(Date.now());

      repository.writeCache({
        data: explorerData,
        intelligenceRecords: validIntel,
        timestamp: Date.now(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      // Only surface a hard error when there is nothing to show (no live or
      // stale data). Otherwise the stale view keeps rendering.
      if (!hasDataRef.current) setError(message);
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [service, repository]);

  // Serve any cached data immediately (even if stale — proper SWR), then
  // revalidate in the background.
  useEffect(() => {
    const cached = repository.getCachedData(true);
    if (cached) {
      setData(cached.data);
      setIntelligenceRecords(cached.intelligenceRecords);
      setLastUpdated(cached.timestamp);
      setLoading(false);
    }
    loadData(false);
  }, [repository, loadData]);

  // Abort any in-flight request when the view unmounts.
  useEffect(() => () => repository.abort(), [repository]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
    loadData(true);
  }, [loadData]);

  return {
    data,
    intelligenceRecords,
    error,
    loading,
    lastUpdated,
    retryCount,
    retry,
    modelsById,
    intelligenceByModel,
    providerCounts,
  };
}

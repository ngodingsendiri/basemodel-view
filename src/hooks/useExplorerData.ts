import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { IntelligenceRecord, ExplorerData, Benchmark, BenchmarkScore } from '../schemas/api';
import type { ModelId, ProviderId } from '../domain/branded';
import { useModelRepository, useModelService } from '../context/modelRegistry/useModelRegistry';
import { reportError } from '../utils/errorReporting';

export interface BenchmarkSummaryEntry {
  name: string;
  count: number;
}

export interface ExplorerDataState {
  data: ExplorerData | null;
  intelligenceRecords: IntelligenceRecord[];
  benchmarkRecords: Benchmark[];
  /** catalog model id -> benchmark name -> { score, rank } (rank 1 = best). */
  benchmarksByModel: ReadonlyMap<ModelId, ReadonlyMap<string, BenchmarkScore>>;
  /** Available rankings, sorted by coverage (largest first). */
  benchmarkSummary: BenchmarkSummaryEntry[];
  error: string | null;
  loading: boolean;
  lastUpdated: number | null;
  retryCount: number;
  retry: () => void;
  modelsById: ReadonlyMap<ModelId, ExplorerData['models'][number]>;
  intelligenceByModel: ReadonlyMap<ModelId, IntelligenceRecord>;
  providerCounts: ReadonlyMap<ProviderId, number>;
}

/** Last path segment of a model id, lowercased — used to match leaderboard
 * ids (e.g. "claude-fable-5" or "meta-llama/Llama-4-...") to catalog ids
 * (e.g. "openrouter/claude-fable-5"). */
function lastSegment(id: string): string {
  const slash = id.lastIndexOf('/');
  const segment = slash === -1 ? id : id.slice(slash + 1);
  return segment.toLowerCase();
}

export function useExplorerData(): ExplorerDataState {
  const service = useModelService();
  const repository = useModelRepository();

  const [data, setData] = useState<ExplorerData | null>(null);
  const [intelligenceRecords, setIntelligenceRecords] = useState<IntelligenceRecord[]>([]);
  const [benchmarkRecords, setBenchmarkRecords] = useState<Benchmark[]>([]);
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

  // Benchmark records are matched to catalog models by last path segment and
  // ranked per benchmark (score desc; rank 1 = best). Benchmarks with no
  // catalog match are dropped.
  const benchmarksByModel = useMemo<ReadonlyMap<ModelId, ReadonlyMap<string, BenchmarkScore>>>(() => {
    const map = new Map<ModelId, Map<string, BenchmarkScore>>();
    if (!data || benchmarkRecords.length === 0) return map;

    const bySegment = new Map<string, ModelId[]>();
    for (const model of data.models) {
      const segment = lastSegment(model.model_id);
      const list = bySegment.get(segment) ?? [];
      list.push(model.model_id);
      bySegment.set(segment, list);
    }

    // Group best score per (benchmark, catalog model).
    const byName = new Map<string, Map<ModelId, number>>();
    for (const record of benchmarkRecords) {
      const targets = bySegment.get(lastSegment(record.model_id));
      if (!targets) continue;
      for (const target of targets) {
        let scores = byName.get(record.benchmark_name);
        if (!scores) {
          scores = new Map();
          byName.set(record.benchmark_name, scores);
        }
        const current = scores.get(target);
        if (current === undefined || record.score > current) scores.set(target, record.score);
      }
    }

    for (const [name, scores] of byName) {
      const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
      ranked.forEach(([catalogId, score], index) => {
        let perModel = map.get(catalogId);
        if (!perModel) {
          perModel = new Map();
          map.set(catalogId, perModel);
        }
        perModel.set(name, { score, rank: index + 1 });
      });
    }
    return map;
  }, [benchmarkRecords, data]);

  const benchmarkSummary = useMemo<BenchmarkSummaryEntry[]>(() => {
    const counts = new Map<string, number>();
    for (const scores of benchmarksByModel.values()) {
      for (const name of scores.keys()) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [benchmarksByModel]);

  const loadData = useCallback(async (isRetry = false) => {
    if (repository.isCircuitOpen()) {
      setError('Too many failed requests. Please wait before retrying.');
      setLoading(false);
      return;
    }

    try {
      if (isRetry) setLoading(true);
      setError(null);

      // Graceful degradation: models + providers are required, intelligence
      // and benchmarks are optional. Their failures keep the catalog usable.
      const [explorerResult, intelResult, benchResult] = await Promise.allSettled([
        service.getExplorerData(),
        service.getIntelligenceRecords(),
        service.getBenchmarkRecords(),
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

      let validBench: Benchmark[] = [];
      if (benchResult.status === 'fulfilled') {
        validBench = benchResult.value;
      } else {
        // Benchmarks unavailable: drop any previously loaded records so the
        // ranking options always reflect the current data (next successful
        // refresh restores them).
        reportError(benchResult.reason);
      }

      setData(explorerData);
      setIntelligenceRecords(validIntel);
      setBenchmarkRecords(validBench);
      setLastUpdated(Date.now());

      repository.writeCache({
        data: explorerData,
        intelligenceRecords: validIntel,
        benchmarkRecords: validBench,
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
      setIntelligenceRecords(cached.intelligenceRecords ?? []);
      setBenchmarkRecords(cached.benchmarkRecords ?? []);
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
    benchmarkRecords,
    benchmarksByModel,
    benchmarkSummary,
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

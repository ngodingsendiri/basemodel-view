import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  CanonicalModel,
  Offering,
  RankingEntry,
  ChangesFeed,
  ExplorerData,
  Benchmark,
  BenchmarkScore,
} from '../schemas/api';
import type { ModelId, ProviderId } from '../domain/branded';
import { useModelRepository, useModelService } from '../context/modelRegistry/useModelRegistry';
import { reportError } from '../utils/errorReporting';

export interface BenchmarkSummaryEntry {
  name: string;
  count: number;
}

/** Resolved economics for one canonical model across all its offerings. */
export interface ModelPricing {
  /** Cheapest known blended price per 1M tokens; 0 when free. */
  price?: number;
  /** Cost tier of the offering driving the displayed price. */
  tier: string;
  /** Offering id the price comes from (undefined when unknown). */
  offering_id?: string;
}

export interface ExplorerDataState {
  data: ExplorerData | null;
  ranking: RankingEntry[];
  changes: ChangesFeed | null;
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
  modelsById: ReadonlyMap<ModelId, CanonicalModel>;
  /** Canonical model -> all provider offerings serving it. */
  offeringsByModel: ReadonlyMap<ModelId, Offering[]>;
  /** Canonical model -> resolved price/tier across offerings. */
  pricingByModel: ReadonlyMap<ModelId, ModelPricing>;
  /** Canonical model ids served by each provider (sidebar counts + filter). */
  modelIdsByProvider: ReadonlyMap<ProviderId, ReadonlySet<ModelId>>;
  /** Pareto ranking entry per canonical model. */
  rankingByModel: ReadonlyMap<ModelId, RankingEntry>;
  /** Offering id -> canonical model id (legacy deep-link support). */
  modelByOfferingId: ReadonlyMap<string, ModelId>;
  /** Canonical models that gained an offering in the latest registry run. */
  newModelIds: ReadonlySet<ModelId>;
  providerCounts: ReadonlyMap<ProviderId, number>;
}

/** Last path segment of a model id, lowercased — used to match leaderboard
 * ids (e.g. "claude-fable-5" or "meta-llama/Llama-4-...") to catalog ids. */
function lastSegment(id: string): string {
  const slash = id.lastIndexOf('/');
  const segment = slash === -1 ? id : id.slice(slash + 1);
  return segment.toLowerCase();
}

/** Resolve the displayed price/tier of a canonical model from its offerings.
 * Prefers the cheapest priced offering; falls back to a Free offering; else
 * Unknown. */
function resolvePricing(offerings: Offering[]): ModelPricing {
  let cheapest: Offering | undefined;
  let freeOffering: Offering | undefined;
  for (const offering of offerings) {
    const price = offering.blended_cost_per_1m;
    if (price != null && price > 0) {
      if (!cheapest || price < (cheapest.blended_cost_per_1m ?? Infinity)) cheapest = offering;
    } else if (!freeOffering && offering.cost_tier === 'Free') {
      freeOffering = offering;
    }
  }
  if (cheapest) {
    return {
      price: cheapest.blended_cost_per_1m,
      tier: cheapest.cost_tier ?? 'Unknown',
      offering_id: cheapest.offering_id,
    };
  }
  if (freeOffering) return { price: 0, tier: 'Free', offering_id: freeOffering.offering_id };
  return { tier: 'Unknown' };
}

export function useExplorerData(): ExplorerDataState {
  const service = useModelService();
  const repository = useModelRepository();

  const [data, setData] = useState<ExplorerData | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [changes, setChanges] = useState<ChangesFeed | null>(null);
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
    const map = new Map<ModelId, CanonicalModel>();
    for (const model of data?.models ?? []) {
      map.set(model.model_id, model);
    }
    return map;
  }, [data]);

  const offeringsByModel = useMemo(() => {
    const map = new Map<ModelId, Offering[]>();
    for (const offering of data?.offerings ?? []) {
      const list = map.get(offering.model_id) ?? [];
      list.push(offering);
      map.set(offering.model_id, list);
    }
    return map;
  }, [data]);

  const pricingByModel = useMemo(() => {
    const map = new Map<ModelId, ModelPricing>();
    for (const [id, offerings] of offeringsByModel) {
      map.set(id, resolvePricing(offerings));
    }
    return map;
  }, [offeringsByModel]);

  const modelIdsByProvider = useMemo(() => {
    const map = new Map<ProviderId, Set<ModelId>>();
    for (const offering of data?.offerings ?? []) {
      const set = map.get(offering.provider_id) ?? new Set<ModelId>();
      set.add(offering.model_id);
      map.set(offering.provider_id, set);
    }
    return map;
  }, [data]);

  const providerCounts = useMemo(() => {
    const counts = new Map<ProviderId, number>();
    for (const [pid, ids] of modelIdsByProvider) counts.set(pid, ids.size);
    return counts;
  }, [modelIdsByProvider]);

  const rankingByModel = useMemo(() => {
    const map = new Map<ModelId, RankingEntry>();
    for (const entry of ranking) map.set(entry.model_id, entry);
    return map;
  }, [ranking]);

  const modelByOfferingId = useMemo(() => {
    const map = new Map<string, ModelId>();
    for (const offering of data?.offerings ?? []) {
      map.set(offering.offering_id, offering.model_id);
    }
    return map;
  }, [data]);

  // changes.json lists offering ids; surface a "New" badge on the canonical
  // model that gained the offering.
  const newModelIds = useMemo(() => {
    const set = new Set<ModelId>();
    for (const offeringId of changes?.added ?? []) {
      const modelId = modelByOfferingId.get(offeringId);
      if (modelId) set.add(modelId);
    }
    return set;
  }, [changes, modelByOfferingId]);

  // Benchmark records are matched to catalog models by last path segment of
  // the model id or any alias, and ranked per benchmark (score desc; rank 1
  // = best). Benchmarks with no catalog match are dropped.
  const benchmarksByModel = useMemo<ReadonlyMap<ModelId, ReadonlyMap<string, BenchmarkScore>>>(() => {
    const map = new Map<ModelId, Map<string, BenchmarkScore>>();
    if (!data || benchmarkRecords.length === 0) return map;

    const bySegment = new Map<string, ModelId[]>();
    for (const model of data.models) {
      const segments = [lastSegment(model.model_id), ...model.aliases.map(lastSegment)];
      for (const segment of new Set(segments)) {
        const list = bySegment.get(segment) ?? [];
        list.push(model.model_id);
        bySegment.set(segment, list);
      }
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

      // Graceful degradation: models + providers + offerings are required;
      // ranking, changes and benchmarks are optional enhancements whose
      // failures keep the catalog usable.
      const [explorerResult, rankingResult, changesResult, benchResult] = await Promise.allSettled([
        service.getExplorerData(),
        service.getRanking(),
        service.getChanges(),
        service.getBenchmarkRecords(),
      ]);

      if (explorerResult.status === 'rejected') {
        throw explorerResult.reason;
      }

      const explorerData = explorerResult.value;
      const knownModelIds = new Set(explorerData.models.map((m) => m.model_id));

      let validRanking: RankingEntry[] = [];
      if (rankingResult.status === 'fulfilled') {
        validRanking = rankingResult.value.filter((r) => knownModelIds.has(r.model_id));
      } else {
        reportError(rankingResult.reason);
        setRanking((prev) => prev.filter((r) => knownModelIds.has(r.model_id)));
      }

      let validChanges: ChangesFeed | null = null;
      if (changesResult.status === 'fulfilled') {
        validChanges = changesResult.value;
      } else {
        reportError(changesResult.reason);
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
      setRanking(validRanking);
      setChanges(validChanges);
      setBenchmarkRecords(validBench);
      setLastUpdated(Date.now());

      repository.writeCache({
        data: explorerData,
        ranking: validRanking,
        changes: validChanges,
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
      setRanking(cached.ranking ?? []);
      setChanges(cached.changes ?? null);
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
    ranking,
    changes,
    benchmarkRecords,
    benchmarksByModel,
    benchmarkSummary,
    error,
    loading,
    lastUpdated,
    retryCount,
    retry,
    modelsById,
    offeringsByModel,
    pricingByModel,
    modelIdsByProvider,
    rankingByModel,
    modelByOfferingId,
    newModelIds,
    providerCounts,
  };
}

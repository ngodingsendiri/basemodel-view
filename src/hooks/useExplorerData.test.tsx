import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useExplorerData } from './useExplorerData';
import { ModelRegistryContext, type ModelRegistryContextValue } from '../context/modelRegistry/ModelRegistryContext';
import { modelId, providerId } from '../domain/branded';
import type { ModelRepository, ModelService, CachedData } from '../domain/models';
import type { ExplorerData, RankingEntry, ChangesFeed, Benchmark } from '../schemas/api';
import { makeModel, makeOffering } from '../test/fixtures';

const explorerData: ExplorerData = {
  models: [
    makeModel('model-1', { name: 'Alpha Model', aliases: ['alpha-one'] }),
    makeModel('model-2', { name: 'Beta Model', aliases: ['beta-two'] }),
  ],
  providers: [
    { provider_id: providerId('a'), name: 'Acme' },
    { provider_id: providerId('b'), name: 'Beta Labs' },
  ],
  offerings: [
    makeOffering('a/model-1', 'model-1', 'a', { cost_tier: 'Free', blended_cost_per_1m: 0 }),
    makeOffering('b/model-1', 'model-1', 'b', { cost_tier: 'Balanced', blended_cost_per_1m: 2 }),
    makeOffering('b/model-2', 'model-2', 'b', { cost_tier: 'Premium', blended_cost_per_1m: 10 }),
  ],
};

const ranking: RankingEntry[] = [
  { model_id: modelId('model-1'), quality_score: 90, benchmark_count: 3, categories: ['code'], pareto_optimal: true },
  // Unknown model ids are dropped when the ranking is applied.
  { model_id: modelId('ghost-model'), quality_score: 50, benchmark_count: 1, categories: [], pareto_optimal: false },
];

const changes: ChangesFeed = {
  generated_at: '2026-08-01T00:00:00Z',
  added: ['b/model-1'],
  removed: [],
  status_changed: [],
};

const benchmarks: Benchmark[] = [
  { benchmark_id: 'mirror-code-model-1', model_id: 'model-1', benchmark_name: 'code', score: 90, source: 'mirror', category: ['code'], rank: 1 },
  { benchmark_id: 'mirror-code-model-2', model_id: 'model-2', benchmark_name: 'code', score: 70, source: 'mirror', category: ['code'], rank: 2 },
  // Matches model-2 through its alias "beta-two" and beats its direct score.
  { benchmark_id: 'mirror-code-beta-two', model_id: 'org/beta-two', benchmark_name: 'code', score: 75, source: 'mirror', category: ['code'], rank: 3 },
];

function createMockContext(overrides: Partial<ModelRegistryContextValue> = {}): ModelRegistryContextValue {
  const repository = {
    getCachedData: vi.fn((): CachedData | null => null),
    writeCache: vi.fn(),
    isCircuitOpen: vi.fn(() => false),
    resetCircuitBreaker: vi.fn(),
    abort: vi.fn(),
  } as unknown as ModelRepository;

  const service = {
    getExplorerData: vi.fn(async () => explorerData),
    getRanking: vi.fn(async () => ranking),
    getChanges: vi.fn(async () => changes),
    getBenchmarkRecords: vi.fn(async () => benchmarks),
  } as ModelService;

  return { repository, service, ...overrides };
}

function wrap(context: ModelRegistryContextValue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ModelRegistryContext.Provider value={context}>{children}</ModelRegistryContext.Provider>;
  };
}

describe('useExplorerData', () => {
  it('loads data and builds lookup maps on mount', async () => {
    const context = createMockContext();
    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(explorerData);
    // Unknown ranking entries are filtered out.
    expect(result.current.ranking.map((r) => r.model_id)).toEqual([modelId('model-1')]);
    expect(result.current.changes).toEqual(changes);
    expect(result.current.error).toBeNull();

    expect(result.current.modelsById.get(modelId('model-1'))?.name).toBe('Alpha Model');
    expect(result.current.offeringsByModel.get(modelId('model-1'))).toHaveLength(2);

    // Pricing prefers the cheapest priced offering over free ones.
    expect(result.current.pricingByModel.get(modelId('model-1'))).toEqual({
      price: 2,
      tier: 'Balanced',
      offering_id: 'b/model-1',
    });
    expect(result.current.pricingByModel.get(modelId('model-2'))).toEqual({
      price: 10,
      tier: 'Premium',
      offering_id: 'b/model-2',
    });

    expect(result.current.providerCounts.get(providerId('a'))).toBe(1);
    expect(result.current.providerCounts.get(providerId('b'))).toBe(2);
    expect(result.current.modelIdsByProvider.get(providerId('a'))?.has(modelId('model-1'))).toBe(true);
    expect(result.current.modelIdsByProvider.get(providerId('a'))?.has(modelId('model-2'))).toBe(false);

    expect(result.current.rankingByModel.get(modelId('model-1'))?.pareto_optimal).toBe(true);
    expect(result.current.modelByOfferingId.get('a/model-1')).toBe(modelId('model-1'));

    // changes.added lists offering ids; the canonical model gains the badge.
    expect(result.current.newModelIds.has(modelId('model-1'))).toBe(true);
    expect(result.current.newModelIds.has(modelId('model-2'))).toBe(false);

    expect(result.current.benchmarkRecords).toEqual(benchmarks);
    expect(result.current.benchmarksByModel.get(modelId('model-1'))?.get('code')).toEqual({ score: 90, rank: 1 });
    // Alias match (org/beta-two) beats the direct score 70.
    expect(result.current.benchmarksByModel.get(modelId('model-2'))?.get('code')).toEqual({ score: 75, rank: 2 });
    expect(result.current.benchmarkSummary).toEqual([{ name: 'code', count: 2 }]);
    expect(context.repository.writeCache).toHaveBeenCalled();
  });

  it('serves stale cache immediately then revalidates (SWR)', async () => {
    const cached: CachedData = {
      data: explorerData,
      ranking,
      changes,
      benchmarkRecords: benchmarks,
      timestamp: Date.now() - 60 * 60 * 1000,
    };
    const context = createMockContext({
      repository: {
        getCachedData: vi.fn(() => cached),
        writeCache: vi.fn(),
        isCircuitOpen: vi.fn(() => false),
        resetCircuitBreaker: vi.fn(),
        abort: vi.fn(),
      } as unknown as ModelRepository,
    });

    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    expect(result.current.data).toEqual(explorerData);
    expect(result.current.loading).toBe(false);

    await waitFor(() => expect(result.current.ranking.length).toBe(1));
    expect(result.current.changes).toEqual(changes);
  });

  it('degrades gracefully when ranking fails but explorer succeeds', async () => {
    const service = {
      getExplorerData: vi.fn(async () => explorerData),
      getRanking: vi.fn(async () => {
        throw new Error('ranking down');
      }),
      getChanges: vi.fn(async () => changes),
      getBenchmarkRecords: vi.fn(async () => benchmarks),
    } as ModelService;
    const context = createMockContext({ service });

    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(explorerData);
    expect(result.current.ranking).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('only surfaces a hard error when there is no data to render', async () => {
    const service = {
      getExplorerData: vi.fn(async () => {
        throw new Error('boom');
      }),
      getRanking: vi.fn(async () => {
        throw new Error('boom');
      }),
      getChanges: vi.fn(async () => {
        throw new Error('boom');
      }),
      getBenchmarkRecords: vi.fn(async () => {
        throw new Error('boom');
      }),
    } as ModelService;
    const context = createMockContext({ service });

    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('retry reloads and increments retryCount', async () => {
    const context = createMockContext();
    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = result.current.retryCount;
    await act(async () => result.current.retry());

    expect(result.current.retryCount).toBe(before + 1);
    expect(context.service.getExplorerData).toHaveBeenCalledTimes(2);
  });

  it('skips loading when the circuit breaker is open', async () => {
    const context = createMockContext({
      repository: {
        getCachedData: vi.fn(() => null),
        writeCache: vi.fn(),
        isCircuitOpen: vi.fn(() => true),
        resetCircuitBreaker: vi.fn(),
        abort: vi.fn(),
      } as unknown as ModelRepository,
    });

    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Too many failed requests. Please wait before retrying.');
    expect(result.current.data).toBeNull();
  });

  it('keeps rendering stale data when the circuit breaker is open', async () => {
    const cached: CachedData = {
      data: explorerData,
      ranking,
      changes,
      benchmarkRecords: benchmarks,
      timestamp: Date.now() - 60 * 60 * 1000,
    };
    const context = createMockContext({
      repository: {
        getCachedData: vi.fn(() => cached),
        writeCache: vi.fn(),
        isCircuitOpen: vi.fn(() => true),
        resetCircuitBreaker: vi.fn(),
        abort: vi.fn(),
      } as unknown as ModelRepository,
    });

    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Stale data stays visible; no hard error is surfaced.
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(explorerData);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useExplorerData } from './useExplorerData';
import { ModelRegistryContext, type ModelRegistryContextValue } from '../context/modelRegistry/ModelRegistryContext';
import { modelId, providerId } from '../domain/branded';
import type { ModelRepository, ModelService, CachedData } from '../domain/models';
import type { ExplorerData, IntelligenceRecord, Benchmark } from '../schemas/api';

const explorerData: ExplorerData = {
  models: [
    { model_id: modelId('a/model1'), name: 'Alpha Model', provider_id: providerId('a'), modality: ['text'] },
    { model_id: modelId('b/model2'), name: 'Beta Model', provider_id: providerId('b'), modality: ['text'] },
  ],
  providers: [
    { provider_id: providerId('a'), name: 'Acme' },
    { provider_id: providerId('b'), name: 'Beta Labs' },
  ],
};

const intel: IntelligenceRecord[] = [
  { model_id: modelId('a/model1'), cost_tier: 'Free', blended_cost_per_1m: 0, alternatives: [] },
];

const benchmarks: Benchmark[] = [
  { benchmark_id: 'mirror-code-model1', model_id: 'model1', benchmark_name: 'code', score: 90, source: 'mirror', category: ['code'], rank: 1 },
  { benchmark_id: 'mirror-code-model2', model_id: 'model2', benchmark_name: 'code', score: 70, source: 'mirror', category: ['code'], rank: 2 },
];

function createMockContext(overrides: Partial<ModelRegistryContextValue> = {}): ModelRegistryContextValue {
  const repository = {
    getCachedData: vi.fn((): CachedData | null => null),
    writeCache: vi.fn(),
    isCircuitOpen: vi.fn(() => false),
    resetCircuitBreaker: vi.fn(),
    abort: vi.fn(),
    fetchModels: vi.fn(async () => explorerData.models),
    fetchProviders: vi.fn(async () => explorerData.providers),
    fetchIntelligence: vi.fn(async () => intel),
    fetchBenchmarks: vi.fn(async () => benchmarks),
  } as unknown as ModelRepository;

  const service = {
    getExplorerData: vi.fn(async () => explorerData),
    getIntelligenceRecords: vi.fn(async () => intel),
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
    expect(result.current.intelligenceRecords).toEqual(intel);
    expect(result.current.error).toBeNull();
    expect(result.current.modelsById.get(modelId('a/model1'))?.name).toBe('Alpha Model');
    expect(result.current.intelligenceByModel.get(modelId('a/model1'))?.cost_tier).toBe('Free');
    expect(result.current.providerCounts.get(providerId('a'))).toBe(1);
    expect(result.current.benchmarkRecords).toEqual(benchmarks);
    expect(result.current.benchmarksByModel.get(modelId('a/model1'))?.get('code')).toEqual({ score: 90, rank: 1 });
    expect(result.current.benchmarksByModel.get(modelId('b/model2'))?.get('code')).toEqual({ score: 70, rank: 2 });
    expect(result.current.benchmarkSummary).toEqual([{ name: 'code', count: 2 }]);
    expect(context.repository.writeCache).toHaveBeenCalled();
  });

  it('serves stale cache immediately then revalidates (SWR)', async () => {
    const cached: CachedData = {
      data: explorerData,
      intelligenceRecords: intel,
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

    await waitFor(() => expect(result.current.intelligenceRecords).toEqual(intel));
  });

  it('degrades gracefully when intelligence fails but explorer succeeds', async () => {
    const service = {
      getExplorerData: vi.fn(async () => explorerData),
      getIntelligenceRecords: vi.fn(async () => {
        throw new Error('intel down');
      }),
      getBenchmarkRecords: vi.fn(async () => benchmarks),
    } as ModelService;
    const context = createMockContext({ service });

    const { result } = renderHook(() => useExplorerData(), { wrapper: wrap(context) });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(explorerData);
    expect(result.current.intelligenceRecords).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('only surfaces a hard error when there is no data to render', async () => {
    const service = {
      getExplorerData: vi.fn(async () => {
        throw new Error('boom');
      }),
      getIntelligenceRecords: vi.fn(async () => {
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
});

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilteredModels } from './useFilteredModels';
import { modelId, providerId } from '../domain/branded';
import type { Model, Provider, IntelligenceRecord } from '../schemas/api';

const mockModels: Model[] = [
  { model_id: modelId('a/model1'), name: 'Alpha Model', provider_id: providerId('a'), context_window: 4096, release_date: '2024-01-01', modality: ['text'] },
  { model_id: modelId('b/model2'), name: 'Beta Model', provider_id: providerId('b'), context_window: 128000, release_date: '2024-06-01', modality: ['text', 'code'] },
  { model_id: modelId('a/model3'), name: 'Gamma Model', provider_id: providerId('a'), context_window: 32768, release_date: '2023-12-01', modality: ['text'] },
];

const mockProviders: Provider[] = [
  { provider_id: providerId('a'), name: 'Acme Cloud' },
  { provider_id: providerId('b'), name: 'Beta Labs' },
];

const mockIntelligence: IntelligenceRecord[] = [
  { model_id: modelId('a/model1'), cost_tier: 'Free', blended_cost_per_1m: 0, alternatives: [] },
  { model_id: modelId('b/model2'), cost_tier: 'Premium', blended_cost_per_1m: 10, alternatives: [] },
  { model_id: modelId('a/model3'), cost_tier: 'Budget-Friendly', blended_cost_per_1m: 1, alternatives: [] },
];

const mockIntelligenceByModel = new Map(mockIntelligence.map((r) => [r.model_id, r]));

// Benchmarks use leaderboard ids (suffix of catalog ids): a/model1 -> model1.
const mockBenchmarks = new Map<ReturnType<typeof modelId>, Map<string, { score: number; rank: number }>>([
  [modelId('a/model1'), new Map([['code', { score: 90, rank: 1 }]])],
  [modelId('b/model2'), new Map([['code', { score: 70, rank: 2 }]])],
]);

describe('useFilteredModels', () => {
  it('filters by provider', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: providerId('a'),
        searchQuery: '',
        freeOnly: false,
        sortKey: 'name',
      })
    );

    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.filtered.every(m => m.provider_id === 'a')).toBe(true);
  });

  it('filters free only', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: true,
        sortKey: 'name',
      })
    );

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].model_id).toBe('a/model1');
  });

  it('filters by search query', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: 'beta',
        freeOnly: false,
        sortKey: 'name',
      })
    );

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe('Beta Model');
  });

  it('filters by provider name in search query', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: 'acme',
        freeOnly: false,
        sortKey: 'name',
      })
    );

    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.filtered.every(m => m.provider_id === 'a')).toBe(true);
  });

  it('sorts by context descending', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'context',
      })
    );

    expect(result.current.filtered[0].context_window).toBe(128000);
    expect(result.current.filtered[1].context_window).toBe(32768);
    expect(result.current.filtered[2].context_window).toBe(4096);
  });

  it('sorts by date descending', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'date',
      })
    );

    expect(result.current.filtered[0].release_date).toBe('2024-06-01');
    expect(result.current.filtered[1].release_date).toBe('2024-01-01');
    expect(result.current.filtered[2].release_date).toBe('2023-12-01');
  });

  it('getTierForModel returns correct tier', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'name',
      })
    );

    expect(result.current.getTierForModel('a/model1')).toBe('Free');
    expect(result.current.getTierForModel('b/model2')).toBe('Premium');
    expect(result.current.getTierForModel('a/model3')).toBe('Budget-Friendly');
    expect(result.current.getTierForModel('unknown')).toBe('Unknown');
  });

  it('getPriceForModel returns blended cost', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'name',
      })
    );

    expect(result.current.getPriceForModel('a/model1')).toBe(0);
    expect(result.current.getPriceForModel('b/model2')).toBe(10);
    expect(result.current.getPriceForModel('a/model3')).toBe(1);
    expect(result.current.getPriceForModel('unknown')).toBeUndefined();
  });

  it('sorts by benchmark ranking descending, unranked last', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        benchmarksByModel: mockBenchmarks,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'rank:code',
      })
    );

    expect(result.current.filtered[0].model_id).toBe('a/model1'); // score 90
    expect(result.current.filtered[1].model_id).toBe('b/model2'); // score 70
    expect(result.current.filtered[2].model_id).toBe('a/model3'); // unranked sinks last
    expect(result.current.rankBenchmark).toBe('code');
  });

  it('getBenchmarkScore returns the score and rank for ranked models only', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        benchmarksByModel: mockBenchmarks,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'rank:code',
      })
    );

    expect(result.current.getBenchmarkScore('a/model1', 'code')).toEqual({ score: 90, rank: 1 });
    expect(result.current.getBenchmarkScore('a/model3', 'code')).toBeUndefined();
  });

  it('falls back to name sort when ranking benchmark is missing', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        benchmarksByModel: mockBenchmarks,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'rank:reasoning',
      })
    );

    expect(result.current.rankBenchmark).toBe('reasoning');
    expect(result.current.filtered[0].name).toBe('Alpha Model'); // all unranked -> name order
  });

  it('sorts by price ascending, unknown last', () => {
    const { result } = renderHook(() =>
      useFilteredModels({
        models: mockModels,
        providers: mockProviders,
        intelligenceByModel: mockIntelligenceByModel,
        selectedProviderId: 'all',
        searchQuery: '',
        freeOnly: false,
        sortKey: 'price',
      })
    );

    expect(result.current.filtered[0].model_id).toBe('a/model1');
    expect(result.current.filtered[1].model_id).toBe('a/model3');
    expect(result.current.filtered[2].model_id).toBe('b/model2');
  });
});

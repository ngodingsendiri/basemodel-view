import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFilteredModels, type UseFilteredModelsProps } from './useFilteredModels';
import { modelId, providerId } from '../domain/branded';
import type { ModelId, ProviderId } from '../domain/branded';
import type { Provider, Offering, RankingEntry } from '../schemas/api';
import { makeModel, makeOffering } from '../test/fixtures';

const mockModels = [
  makeModel('model1', {
    name: 'Alpha Model',
    context_window: 4096,
    release_date: '2024-01-01',
    modality: ['text'],
    aliases: ['alpha-one'],
    quality: { score: 90, benchmark_count: 2, categories: [], sources: [] },
  }),
  makeModel('model2', {
    name: 'Beta Model',
    context_window: 128000,
    release_date: '2024-06-01',
    modality: ['text', 'code'],
    quality: { score: 70, benchmark_count: 1, categories: [], sources: [] },
  }),
  makeModel('model3', {
    name: 'Gamma Model',
    context_window: 32768,
    release_date: '2023-12-01',
    modality: ['text'],
  }),
];

const mockProviders: Provider[] = [
  { provider_id: providerId('a'), name: 'Acme Cloud' },
  { provider_id: providerId('b'), name: 'Beta Labs' },
];

const mockOfferings: Offering[] = [
  makeOffering('a/model1', 'model1', 'a', { cost_tier: 'Free', blended_cost_per_1m: 0 }),
  // Second provider serves model1 without pricing (Unknown tier).
  makeOffering('b/model1', 'model1', 'b'),
  makeOffering('b/model2', 'model2', 'b', { cost_tier: 'Premium', blended_cost_per_1m: 10 }),
  makeOffering('a/model3', 'model3', 'a', { cost_tier: 'Budget-Friendly', blended_cost_per_1m: 1 }),
];

const offeringsByModel = new Map<ModelId, Offering[]>([
  [modelId('model1'), [mockOfferings[0], mockOfferings[1]]],
  [modelId('model2'), [mockOfferings[2]]],
  [modelId('model3'), [mockOfferings[3]]],
]);

const pricingByModel = new Map<ModelId, { price?: number; tier: string; offering_id?: string }>([
  [modelId('model1'), { price: 0, tier: 'Free', offering_id: 'a/model1' }],
  [modelId('model2'), { price: 10, tier: 'Premium', offering_id: 'b/model2' }],
  [modelId('model3'), { price: 1, tier: 'Budget-Friendly', offering_id: 'a/model3' }],
]);

const modelIdsByProvider = new Map<ProviderId, ReadonlySet<ModelId>>([
  [providerId('a'), new Set([modelId('model1'), modelId('model3')])],
  [providerId('b'), new Set([modelId('model1'), modelId('model2')])],
]);

const rankingByModel = new Map<ModelId, RankingEntry>();

// Benchmarks use leaderboard ids (suffix of catalog ids): a/model1 -> model1.
const mockBenchmarks = new Map<ModelId, Map<string, { score: number; rank: number }>>([
  [modelId('model1'), new Map([['code', { score: 90, rank: 1 }]])],
  [modelId('model2'), new Map([['code', { score: 70, rank: 2 }]])],
]);

function renderFiltered(overrides: Partial<UseFilteredModelsProps> = {}) {
  return renderHook(() =>
    useFilteredModels({
      models: mockModels,
      providers: mockProviders,
      offeringsByModel,
      pricingByModel,
      modelIdsByProvider,
      rankingByModel,
      selectedProviderId: 'all',
      searchQuery: '',
      freeOnly: false,
      sortKey: 'name',
      ...overrides,
    })
  );
}

describe('useFilteredModels', () => {
  it('filters by provider via its offerings', () => {
    const { result } = renderFiltered({ selectedProviderId: providerId('a') });

    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.filtered.map((m) => m.model_id)).toEqual(['model1', 'model3']);
  });

  it('filters free only', () => {
    const { result } = renderFiltered({ freeOnly: true });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].model_id).toBe('model1');
  });

  it('filters by search query', () => {
    const { result } = renderFiltered({ searchQuery: 'beta model' });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe('Beta Model');
  });

  it('matches model aliases in search', () => {
    const { result } = renderFiltered({ searchQuery: 'alpha-one' });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].model_id).toBe('model1');
  });

  it('filters by provider name in search query', () => {
    const { result } = renderFiltered({ searchQuery: 'acme' });

    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.filtered.map((m) => m.model_id)).toEqual(['model1', 'model3']);
  });

  it('sorts by context descending', () => {
    const { result } = renderFiltered({ sortKey: 'context' });

    expect(result.current.filtered[0].context_window).toBe(128000);
    expect(result.current.filtered[1].context_window).toBe(32768);
    expect(result.current.filtered[2].context_window).toBe(4096);
  });

  it('sorts by date descending', () => {
    const { result } = renderFiltered({ sortKey: 'date' });

    expect(result.current.filtered[0].release_date).toBe('2024-06-01');
    expect(result.current.filtered[1].release_date).toBe('2024-01-01');
    expect(result.current.filtered[2].release_date).toBe('2023-12-01');
  });

  it('sorts by quality score descending, unscored last', () => {
    const { result } = renderFiltered({ sortKey: 'quality' });

    expect(result.current.filtered.map((m) => m.model_id)).toEqual(['model1', 'model2', 'model3']);
  });

  it('getTierForModel returns correct tier', () => {
    const { result } = renderFiltered();

    expect(result.current.getTierForModel('model1')).toBe('Free');
    expect(result.current.getTierForModel('model2')).toBe('Premium');
    expect(result.current.getTierForModel('model3')).toBe('Budget-Friendly');
    expect(result.current.getTierForModel('unknown')).toBe('Unknown');
  });

  it('getPriceForModel returns cheapest blended cost', () => {
    const { result } = renderFiltered();

    expect(result.current.getPriceForModel('model1')).toBe(0);
    expect(result.current.getPriceForModel('model2')).toBe(10);
    expect(result.current.getPriceForModel('model3')).toBe(1);
    expect(result.current.getPriceForModel('unknown')).toBeUndefined();
  });

  it('getProviderCount returns the number of offerings', () => {
    const { result } = renderFiltered();

    expect(result.current.getProviderCount('model1')).toBe(2);
    expect(result.current.getProviderCount('model2')).toBe(1);
    expect(result.current.getProviderCount('unknown')).toBe(0);
  });

  it('sorts by benchmark ranking descending, unranked last', () => {
    const { result } = renderFiltered({
      benchmarksByModel: mockBenchmarks,
      sortKey: 'rank:code',
    });

    expect(result.current.filtered[0].model_id).toBe('model1'); // score 90
    expect(result.current.filtered[1].model_id).toBe('model2'); // score 70
    expect(result.current.filtered[2].model_id).toBe('model3'); // unranked sinks last
    expect(result.current.rankBenchmark).toBe('code');
  });

  it('getBenchmarkScore returns the score and rank for ranked models only', () => {
    const { result } = renderFiltered({
      benchmarksByModel: mockBenchmarks,
      sortKey: 'rank:code',
    });

    expect(result.current.getBenchmarkScore('model1', 'code')).toEqual({ score: 90, rank: 1 });
    expect(result.current.getBenchmarkScore('model3', 'code')).toBeUndefined();
  });

  it('falls back to name sort when ranking benchmark is missing', () => {
    const { result } = renderFiltered({
      benchmarksByModel: mockBenchmarks,
      sortKey: 'rank:reasoning',
    });

    expect(result.current.rankBenchmark).toBe('reasoning');
    expect(result.current.filtered[0].name).toBe('Alpha Model'); // all unranked -> name order
  });

  it('sorts by price ascending, unknown last', () => {
    const { result } = renderFiltered({ sortKey: 'price' });

    expect(result.current.filtered[0].model_id).toBe('model1');
    expect(result.current.filtered[1].model_id).toBe('model3');
    expect(result.current.filtered[2].model_id).toBe('model2');
  });
});

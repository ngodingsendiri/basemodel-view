import type { Page } from '@playwright/test';

export const API_BASE = 'https://raw.githubusercontent.com/ngodingsendiri/BaseModel/main/dist';
export const CDN_BASE = 'https://cdn.jsdelivr.net/gh/ngodingsendiri/BaseModel@main/dist';

// Canonical (deduplicated) models — provider serves live in mockOfferings.
export const mockModels = {
  models: [
    {
      model_id: 'model-1',
      name: 'Test Alpha Model',
      description: 'A test model',
      release_date: '2024-01-01T00:00:00Z',
      context_window: 4096,
      modality: ['text'],
      aliases: ['alpha-one'],
      offering_ids: ['testco/model-1', 'otherco/model-1'],
      quality: { score: 88.5, benchmark_count: 3, categories: ['code'], sources: ['mirror'] },
    },
    {
      model_id: 'model-2',
      name: 'Beta Model Two',
      description: 'Another test model',
      release_date: '2024-06-01T00:00:00Z',
      context_window: 128000,
      modality: ['text', 'code'],
      offering_ids: ['otherco/model-2'],
    },
  ],
};

export const mockProviders = {
  providers: [
    { provider_id: 'testco', name: 'Test Company' },
    { provider_id: 'otherco', name: 'Other Company' },
  ],
};

export const mockOfferings = {
  offerings: [
    {
      offering_id: 'testco/model-1',
      model_id: 'model-1',
      provider_id: 'testco',
      status: 'active',
      cost_tier: 'Free',
      blended_cost_per_1m: 0,
      is_cheapest: true,
    },
    // Unpriced second provider — exercises the "Available Providers" list.
    {
      offering_id: 'otherco/model-1',
      model_id: 'model-1',
      provider_id: 'otherco',
      status: 'active',
    },
    {
      offering_id: 'otherco/model-2',
      model_id: 'model-2',
      provider_id: 'otherco',
      status: 'active',
      cost_tier: 'Premium',
      blended_cost_per_1m: 10,
    },
  ],
};

export const mockRanking = {
  ranking: [
    {
      model_id: 'model-1',
      quality_score: 88.5,
      benchmark_count: 3,
      categories: ['code'],
      cheapest_offering: 'testco/model-1',
      cheapest_provider: 'testco',
      blended_cost_per_1m: 0,
      pareto_optimal: true,
    },
    {
      model_id: 'model-2',
      quality_score: 70,
      benchmark_count: 2,
      categories: ['code'],
      cheapest_offering: 'otherco/model-2',
      cheapest_provider: 'otherco',
      blended_cost_per_1m: 10,
      pareto_optimal: false,
    },
  ],
};

// Registry delta feed — ids are offering ids; "otherco/model-1" puts the New
// badge on the canonical model-1.
export const mockChanges = {
  generated_at: '2026-08-01T00:00:00Z',
  added: ['otherco/model-1'],
  removed: [],
  status_changed: [],
};

// Leaderboard ids use the model name suffix (mirror style) so they exercise
// the same last-segment matching the real dataset relies on.
export const mockBenchmarks = {
  benchmarks: [
    {
      benchmark_id: 'mirror-code-model-1',
      model_id: 'model-1',
      benchmark_name: 'code',
      score: 92,
      score_raw: 1550,
      source: 'mirror',
      category: ['code'],
      rank: 1,
    },
    {
      benchmark_id: 'mirror-code-model-2',
      model_id: 'model-2',
      benchmark_name: 'code',
      score: 68,
      score_raw: 1200,
      source: 'mirror',
      category: ['code'],
      rank: 2,
    },
  ],
};

export function mockDataRoutes(page: Page) {
  for (const base of [API_BASE, CDN_BASE]) {
    page.route(`${base}/v2/models.json`, (route) =>
      route.fulfill({ json: mockModels })
    );
    page.route(`${base}/providers.json`, (route) =>
      route.fulfill({ json: mockProviders })
    );
    page.route(`${base}/v2/offerings.json`, (route) =>
      route.fulfill({ json: mockOfferings })
    );
    page.route(`${base}/v2/intelligence.json`, (route) =>
      route.fulfill({ json: mockRanking })
    );
    page.route(`${base}/changes.json`, (route) =>
      route.fulfill({ json: mockChanges })
    );
    page.route(`${base}/benchmarks.json`, (route) =>
      route.fulfill({ json: mockBenchmarks })
    );
  }
}

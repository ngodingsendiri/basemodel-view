import type { Page } from '@playwright/test';

export const API_BASE = 'https://raw.githubusercontent.com/ngodingsendiri/BaseModel/main/dist';
export const CDN_BASE = 'https://cdn.jsdelivr.net/gh/ngodingsendiri/BaseModel@main/dist';

export const mockModels = {
  models: [
    {
      model_id: 'testco/model-1',
      name: 'Test Alpha Model',
      provider_id: 'testco',
      context_window: 4096,
      max_output_tokens: 2048,
      release_date: '2024-01-01T00:00:00Z',
      modality: ['text'],
      description: 'A test model',
    },
    {
      model_id: 'otherco/model-2',
      name: 'Beta Model Two',
      provider_id: 'otherco',
      context_window: 128000,
      release_date: '2024-06-01T00:00:00Z',
      modality: ['text', 'code'],
      description: 'Another test model',
    },
  ],
};

export const mockProviders = {
  providers: [
    { provider_id: 'testco', name: 'Test Company' },
    { provider_id: 'otherco', name: 'Other Company' },
  ],
};

export const mockIntelligence = {
  intelligence: [
    {
      model_id: 'testco/model-1',
      cost_tier: 'Free',
      blended_cost_per_1m: 0,
      alternatives: [
        { model_id: 'otherco/model-2', name: 'Beta Model Two', reason: 'Cheaper per token' },
        { model_id: 'testco/model-3', name: 'Gamma Model Three', reason: 'Similar capability' },
        { model_id: 'testco/model-4', name: 'Delta Model Four', reason: 'Good balance' },
        { model_id: 'testco/model-5', name: 'Epsilon Model Five', reason: 'Higher throughput' },
        { model_id: 'testco/model-6', name: 'Zeta Model Six', reason: 'Lower latency' },
      ],
    },
    {
      model_id: 'otherco/model-2',
      cost_tier: 'Premium',
      blended_cost_per_1m: 10,
      alternatives: [],
    },
  ],
};

export function mockDataRoutes(page: Page) {
  for (const base of [API_BASE, CDN_BASE]) {
    page.route(`${base}/models.json`, (route) =>
      route.fulfill({ json: mockModels })
    );
    page.route(`${base}/providers.json`, (route) =>
      route.fulfill({ json: mockProviders })
    );
    page.route(`${base}/intelligence.json`, (route) =>
      route.fulfill({ json: mockIntelligence })
    );
  }
}

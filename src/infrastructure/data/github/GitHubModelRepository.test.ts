import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { modelId, providerId } from '../../../domain/branded';
import { GitHubModelRepository } from './GitHubModelRepository';

const mockModels = { models: [{ model_id: modelId('test/model'), name: 'Test Model', provider_id: providerId('test'), modality: [] }] };
const mockProviders = { providers: [{ provider_id: providerId('test'), name: 'Test Provider' }] };
const mockIntelligence = { intelligence: [{ model_id: modelId('test/model'), cost_tier: 'Free', blended_cost_per_1m: 0, alternatives: [] }] };
const mockBenchmarks = {
  benchmarks: [{ benchmark_id: 'mirror-code-test-model', model_id: 'test/model', benchmark_name: 'code', score: 85.5, source: 'mirror' as const, category: ['code'], rank: 3 }],
};

function createRepository() {
  // Disable rate limiting and retries/backoff so unit tests run instantly.
  return new GitHubModelRepository({ minRequestInterval: 0, maxRetries: 0, retryBaseDelay: 0 });
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body } as unknown as Response;
}

describe('GitHubModelRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches and validates all data files', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(mockModels))
      .mockResolvedValueOnce(okResponse(mockProviders))
      .mockResolvedValueOnce(okResponse(mockIntelligence));
    vi.stubGlobal('fetch', fetchMock);

    const repo = createRepository();

    await expect(repo.fetchModels()).resolves.toEqual(mockModels.models);
    await expect(repo.fetchProviders()).resolves.toEqual(mockProviders.providers);
    await expect(repo.fetchIntelligence()).resolves.toEqual(mockIntelligence.intelligence);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fetches and validates the benchmarks file', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse(mockBenchmarks));
    vi.stubGlobal('fetch', fetchMock);

    const repo = createRepository();
    await expect(repo.fetchBenchmarks()).resolves.toEqual(mockBenchmarks.benchmarks);
  });

  it('fails over to the CDN mirror when the primary source errors', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce(okResponse(mockModels));
    vi.stubGlobal('fetch', fetchMock);

    const repo = createRepository();
    await expect(repo.fetchModels()).resolves.toEqual(mockModels.models);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid schema data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ models: [{ model_id: '' }] })));

    const repo = createRepository();
    await expect(repo.fetchModels()).rejects.toThrow('Invalid models');
  });

  it('accepts real pipeline data with date-only release dates and extra fields', async () => {
    const realModels = {
      schema_version: '0.1.0',
      source_revision: '225089a',
      count: 2,
      models: [
        {
          model_id: 'anthropic/claude-3-5-haiku',
          provider_id: 'anthropic',
          name: 'Claude 3.5 Haiku',
          family: 'Claude 3.5',
          version: '20241022',
          release_date: '2024-11-05',
          description: 'Anthropic fast compact model.',
          architecture: 'transformer',
          context_window: 200000,
          modality: ['text', 'image'],
          open_weight: false,
          reasoning_support: false,
          function_calling: true,
          structured_output: true,
          vision_support: true,
          audio_support: false,
          image_generation: false,
          embedding_support: false,
          capability_ids: ['text-generation', 'code-generation', 'vision', 'tool-calling'],
          license_id: 'proprietary',
          status: 'active',
        },
        {
          model_id: 'openai/gpt-4o',
          provider_id: 'openai',
          name: 'GPT-4o',
          family: 'GPT-4',
          version: '2024-08-06',
          release_date: '2024-05-13',
          description: 'OpenAI flagship multimodal model.',
          context_window: 128000,
          modality: ['text', 'image', 'audio'],
          open_weight: false,
          status: 'active',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(realModels)));

    const repo = createRepository();
    const result = await repo.fetchModels();
    expect(result).toHaveLength(2);
    expect(result[0].model_id).toBe('anthropic/claude-3-5-haiku');
    expect(result[0].release_date).toBe('2024-11-05');
    expect(result[1].model_id).toBe('openai/gpt-4o');
  });

  it('opens the circuit breaker after repeated failures and reports it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    const repo = createRepository();

    for (let i = 0; i < 5; i++) {
      await expect(repo.fetchModels()).rejects.toThrow('boom');
    }

    expect(repo.isCircuitOpen()).toBe(true);
    await expect(repo.fetchModels()).rejects.toThrow('Circuit breaker open');
  });

  it('recovers after the circuit breaker is reset', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    const repo = createRepository();
    for (let i = 0; i < 5; i++) {
      await expect(repo.fetchModels()).rejects.toThrow();
    }
    expect(repo.isCircuitOpen()).toBe(true);

    repo.resetCircuitBreaker();
    expect(repo.isCircuitOpen()).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(mockModels)));
    await expect(repo.fetchModels()).resolves.toEqual(mockModels.models);
  });

  it('does not throttle healthy parallel requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(mockModels))
      .mockResolvedValueOnce(okResponse(mockProviders))
      .mockResolvedValueOnce(okResponse(mockIntelligence));
    vi.stubGlobal('fetch', fetchMock);

    // A large interval would hang these if throttling applied to healthy requests.
    const repo = new GitHubModelRepository({ minRequestInterval: 60_000, maxRetries: 0, retryBaseDelay: 0 });

    const results = await Promise.race([
      Promise.all([repo.fetchModels(), repo.fetchProviders(), repo.fetchIntelligence()]),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 200)),
    ]);
    expect(results).not.toBe('timeout');
  });

  it('reads and writes the localStorage cache with a TTL', () => {
    const repo = createRepository();
    expect(repo.getCachedData()).toBeNull();

    repo.writeCache({
      data: { models: mockModels.models, providers: mockProviders.providers },
      intelligenceRecords: mockIntelligence.intelligence,
      benchmarkRecords: mockBenchmarks.benchmarks,
      timestamp: Date.now(),
    });

    expect(repo.getCachedData()).not.toBeNull();

    repo.writeCache({
      data: { models: [], providers: [] },
      intelligenceRecords: [],
      benchmarkRecords: [],
      timestamp: Date.now() - 11 * 60 * 1000,
    });
    expect(repo.getCachedData()).toBeNull();
  });
});

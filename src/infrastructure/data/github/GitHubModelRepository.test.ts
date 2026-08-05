import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubModelRepository } from './GitHubModelRepository';

// Wire-format fixtures (pre-validation); Zod defaults fill the rest.
const mockModels = { models: [{ model_id: 'test-model', name: 'Test Model' }] };
const mockProviders = { providers: [{ provider_id: 'test', name: 'Test Provider' }] };
const mockOfferings = {
  offerings: [
    {
      offering_id: 'test/test-model',
      model_id: 'test-model',
      provider_id: 'test',
      status: 'active',
      cost_tier: 'Free',
      blended_cost_per_1m: 0,
      is_cheapest: true,
    },
  ],
};
const mockRanking = {
  ranking: [
    { model_id: 'test-model', quality_score: 88.5, benchmark_count: 2, categories: ['code'], pareto_optimal: true },
  ],
};
const mockChanges = {
  generated_at: '2026-08-01T00:00:00Z',
  added: ['test/test-model'],
  removed: [],
  status_changed: [],
};
const mockBenchmarks = {
  benchmarks: [{ benchmark_id: 'mirror-code-test-model', model_id: 'test-model', benchmark_name: 'code', score: 85.5, source: 'mirror' as const, category: ['code'], rank: 3 }],
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

  it('fetches and validates the core explorer files', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(mockModels))
      .mockResolvedValueOnce(okResponse(mockProviders))
      .mockResolvedValueOnce(okResponse(mockOfferings));
    vi.stubGlobal('fetch', fetchMock);

    const repo = createRepository();

    const models = await repo.fetchCanonicalModels();
    expect(models).toHaveLength(1);
    expect(models[0].model_id).toBe('test-model');
    expect(models[0].aliases).toEqual([]); // Zod defaults applied

    await expect(repo.fetchProviders()).resolves.toEqual(mockProviders.providers);

    const offerings = await repo.fetchOfferings();
    expect(offerings).toHaveLength(1);
    expect(offerings[0].offering_id).toBe('test/test-model');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fetches and validates the ranking and changes files', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(mockRanking))
      .mockResolvedValueOnce(okResponse(mockChanges));
    vi.stubGlobal('fetch', fetchMock);

    const repo = createRepository();

    const ranking = await repo.fetchRanking();
    expect(ranking).toHaveLength(1);
    expect(ranking[0].quality_score).toBe(88.5);
    expect(ranking[0].pareto_optimal).toBe(true);

    const changes = await repo.fetchChanges();
    expect(changes.added).toEqual(['test/test-model']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    const models = await repo.fetchCanonicalModels();
    expect(models).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid schema data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ models: [{ model_id: '' }] })));

    const repo = createRepository();
    await expect(repo.fetchCanonicalModels()).rejects.toThrow('Invalid models');
  });

  it('accepts real pipeline data with aliases, quality, and extra fields', async () => {
    const realModels = {
      schema_version: '2.0.0',
      source_revision: '29088dc',
      count: 2,
      models: [
        {
          model_id: 'claude-3-5-haiku',
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
          aliases: ['claude-3-5-haiku-20241022'],
          offering_ids: ['anthropic/claude-3-5-haiku'],
        },
        {
          model_id: 'gpt-4o',
          name: 'GPT-4o',
          family: 'GPT-4',
          release_date: '2024-05-13',
          description: 'OpenAI flagship multimodal model.',
          context_window: 128000,
          modality: ['text', 'image', 'audio'],
          status: 'active',
          quality: { score: 87.2, benchmark_count: 4, categories: ['general'], sources: ['mirror'] },
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(realModels)));

    const repo = createRepository();
    const result = await repo.fetchCanonicalModels();
    expect(result).toHaveLength(2);
    expect(result[0].model_id).toBe('claude-3-5-haiku');
    expect(result[0].release_date).toBe('2024-11-05');
    expect(result[0].aliases).toEqual(['claude-3-5-haiku-20241022']);
    expect(result[1].model_id).toBe('gpt-4o');
    expect(result[1].quality?.score).toBe(87.2);
  });

  it('opens the circuit breaker after repeated failures and reports it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    const repo = createRepository();

    for (let i = 0; i < 5; i++) {
      await expect(repo.fetchCanonicalModels()).rejects.toThrow('boom');
    }

    expect(repo.isCircuitOpen()).toBe(true);
    await expect(repo.fetchCanonicalModels()).rejects.toThrow('Circuit breaker open');
  });

  it('recovers after the circuit breaker is reset', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    const repo = createRepository();
    for (let i = 0; i < 5; i++) {
      await expect(repo.fetchCanonicalModels()).rejects.toThrow();
    }
    expect(repo.isCircuitOpen()).toBe(true);

    repo.resetCircuitBreaker();
    expect(repo.isCircuitOpen()).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(mockModels)));
    const models = await repo.fetchCanonicalModels();
    expect(models).toHaveLength(1);
  });

  it('does not throttle healthy parallel requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(mockModels))
      .mockResolvedValueOnce(okResponse(mockProviders))
      .mockResolvedValueOnce(okResponse(mockOfferings));
    vi.stubGlobal('fetch', fetchMock);

    // A large interval would hang these if throttling applied to healthy requests.
    const repo = new GitHubModelRepository({ minRequestInterval: 60_000, maxRetries: 0, retryBaseDelay: 0 });

    const results = await Promise.race([
      Promise.all([repo.fetchCanonicalModels(), repo.fetchProviders(), repo.fetchOfferings()]),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 200)),
    ]);
    expect(results).not.toBe('timeout');
  });

  it('reads and writes the localStorage cache with a TTL', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(mockModels))
      .mockResolvedValueOnce(okResponse(mockProviders))
      .mockResolvedValueOnce(okResponse(mockOfferings))
      .mockResolvedValueOnce(okResponse(mockRanking))
      .mockResolvedValueOnce(okResponse(mockChanges))
      .mockResolvedValueOnce(okResponse(mockBenchmarks));
    vi.stubGlobal('fetch', fetchMock);

    const repo = createRepository();
    const models = await repo.fetchCanonicalModels();
    const providers = await repo.fetchProviders();
    const offerings = await repo.fetchOfferings();
    const ranking = await repo.fetchRanking();
    const changes = await repo.fetchChanges();
    const benchmarks = await repo.fetchBenchmarks();

    expect(repo.getCachedData()).toBeNull();

    repo.writeCache({
      data: { models, providers, offerings },
      ranking,
      changes,
      benchmarkRecords: benchmarks,
      timestamp: Date.now(),
    });

    expect(repo.getCachedData()?.data.models).toEqual(models);
    expect(repo.getCachedData()?.changes?.added).toEqual(['test/test-model']);

    repo.writeCache({
      data: { models, providers, offerings },
      ranking: [],
      changes: null,
      benchmarkRecords: [],
      timestamp: Date.now() - 11 * 60 * 1000,
    });
    expect(repo.getCachedData()).toBeNull();
  });
});

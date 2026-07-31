import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { modelId, providerId } from '../../../domain/branded';
import { GitHubModelRepository } from './GitHubModelRepository';

const mockModels = { models: [{ model_id: modelId('test/model'), name: 'Test Model', provider_id: providerId('test'), modality: [] }] };
const mockProviders = { providers: [{ provider_id: providerId('test'), name: 'Test Provider' }] };
const mockIntelligence = { intelligence: [{ model_id: modelId('test/model'), cost_tier: 'Free', blended_cost_per_1m: 0, alternatives: [] }] };

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
      timestamp: Date.now(),
    });

    expect(repo.getCachedData()).not.toBeNull();

    repo.writeCache({
      data: { models: [], providers: [] },
      intelligenceRecords: [],
      timestamp: Date.now() - 11 * 60 * 1000,
    });
    expect(repo.getCachedData()).toBeNull();
  });
});

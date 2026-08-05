import type {
  ExplorerData,
  RankingEntry,
  ChangesFeed,
  Benchmark,
} from '../../schemas/api';
import type { ModelRepository, ModelService } from '.';

export class ModelServiceImpl implements ModelService {
  private readonly repository: ModelRepository;

  constructor(repository: ModelRepository) {
    this.repository = repository;
  }

  abort(): void {
    this.repository.abort();
  }

  async getExplorerData(): Promise<ExplorerData> {
    const [models, providers, offerings] = await Promise.all([
      this.repository.fetchCanonicalModels(),
      this.repository.fetchProviders(),
      this.repository.fetchOfferings(),
    ]);
    return { models, providers, offerings };
  }

  async getRanking(): Promise<RankingEntry[]> {
    return this.repository.fetchRanking();
  }

  async getChanges(): Promise<ChangesFeed> {
    return this.repository.fetchChanges();
  }

  async getBenchmarkRecords(): Promise<Benchmark[]> {
    return this.repository.fetchBenchmarks();
  }
}

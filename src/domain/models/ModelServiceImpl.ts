import type { IntelligenceRecord, ExplorerData } from '../../schemas/api';
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
    const [models, providers] = await Promise.all([
      this.repository.fetchModels(),
      this.repository.fetchProviders(),
    ]);
    return { models, providers };
  }

  async getIntelligenceRecords(): Promise<IntelligenceRecord[]> {
    return this.repository.fetchIntelligence();
  }
}

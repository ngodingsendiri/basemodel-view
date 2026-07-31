import type { Model, IntelligenceRecord, ExplorerData } from '../../schemas/api';
import type { ModelId } from '../branded';
import type {
  ModelRepository,
  ModelService,
  FilterOptions,
  FilteredResult,
} from '.';
import { sortModels } from '.';

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

  filterModels(
    models: Model[],
    intelligence: IntelligenceRecord[],
    options: FilterOptions
  ): FilteredResult {
    const tierMap = new Map<ModelId, string>(intelligence.map((r) => [r.model_id, r.cost_tier]));
    const getTier = (modelId: ModelId) => tierMap.get(modelId) ?? 'Unknown';

    let filtered = models;

    if (options.providerId && options.providerId !== 'all') {
      filtered = filtered.filter((m) => m.provider_id === options.providerId);
    }

    if (options.freeOnly) {
      filtered = filtered.filter((m) => getTier(m.model_id) === 'Free');
    }

    if (options.searchQuery?.trim()) {
      const query = options.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) || m.model_id.toLowerCase().includes(query)
      );
    }

    const sorted = sortModels(filtered, options.sortKey ?? 'name');

    return { models: sorted, getTier };
  }
}


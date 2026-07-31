import { createContext } from 'react';
import type { ModelRepository, ModelService } from '../../domain/models';

export interface ModelRegistryContextValue {
  repository: ModelRepository;
  service: ModelService;
}

export const ModelRegistryContext = createContext<ModelRegistryContextValue | null>(null);

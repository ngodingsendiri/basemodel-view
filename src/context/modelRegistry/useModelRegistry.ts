import { useContext } from 'react';
import type { ModelRepository, ModelService } from '../../domain/models';
import { ModelRegistryContext } from './ModelRegistryContext';

export function useModelRepository(): ModelRepository {
  const context = useContext(ModelRegistryContext);
  if (!context) throw new Error('useModelRepository must be used within ModelRegistryProvider');
  return context.repository;
}

export function useModelService(): ModelService {
  const context = useContext(ModelRegistryContext);
  if (!context) throw new Error('useModelService must be used within ModelRegistryProvider');
  return context.service;
}

import { useMemo, type ReactNode } from 'react';
import type { ModelRepository, ModelService } from '../../domain/models';
import { GitHubModelRepository } from '../../infrastructure/data/github/GitHubModelRepository';
import { ModelServiceImpl } from '../../domain/models/ModelServiceImpl';
import { ModelRegistryContext, type ModelRegistryContextValue } from './ModelRegistryContext';

export function ModelRegistryProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ModelRegistryContextValue>(() => {
    const repository: ModelRepository = new GitHubModelRepository();
    const service: ModelService = new ModelServiceImpl(repository);
    return { repository, service };
  }, []);

  return (
    <ModelRegistryContext.Provider value={value}>
      {children}
    </ModelRegistryContext.Provider>
  );
}

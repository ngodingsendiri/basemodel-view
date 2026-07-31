import type { ProviderId } from '../domain/branded';

export type SortKey = 'name' | 'context' | 'date';

export type ProviderFilter = ProviderId | 'all';

export function parseSortKey(value: string | null): SortKey {
  if (value === 'context' || value === 'date') return value;
  return 'name';
}

export function parseBoolean(value: string | null): boolean {
  return value === 'true';
}

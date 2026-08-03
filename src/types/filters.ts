import type { ProviderId } from '../domain/branded';

export type SortKey = 'name' | 'context' | 'date' | 'price' | `rank:${string}`;

export type ProviderFilter = ProviderId | 'all';

/** Returns the benchmark name for a rank sort key, or null when not one. */
export function rankBenchmarkFromKey(sortKey: SortKey): string | null {
  return sortKey.startsWith('rank:') ? sortKey.slice('rank:'.length) : null;
}

export function parseSortKey(value: string | null): SortKey {
  if (value === 'context' || value === 'date' || value === 'price') return value;
  if (value?.startsWith('rank:') && value.length > 'rank:'.length) return value as SortKey;
  return 'name';
}

export function parseBoolean(value: string | null): boolean {
  return value === 'true';
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { providerId } from '../domain/branded';
import { useDebouncedValue } from './useDebouncedValue';
import { parseBoolean, parseSortKey, type ProviderFilter, type SortKey } from '../types/filters';

export interface FiltersState {
  selectedProviderId: ProviderFilter;
  setSelectedProviderId: (p: ProviderFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  /** Debounced search value (150ms) used for filtering. */
  debouncedSearchQuery: string;
  freeOnly: boolean;
  setFreeOnly: (b: boolean) => void;
  sortKey: SortKey;
  setSortKey: (k: SortKey) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useFilters(): FiltersState {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedProviderId, setSelectedProviderId] = useState<ProviderFilter>(() => {
    const raw = searchParams.get('provider');
    return raw ? providerId(raw) : 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') ?? '');
  const [freeOnly, setFreeOnly] = useState<boolean>(() => parseBoolean(searchParams.get('free')));
  const [sortKey, setSortKey] = useState<SortKey>(() => parseSortKey(searchParams.get('sort')));

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 150);

  // Sync filter state to URL params when it changes. Uses a functional update
  // so unrelated params (e.g. `alt`, `compare`) are preserved.
  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (selectedProviderId !== 'all') params.set('provider', selectedProviderId);
      else params.delete('provider');
      if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
      else params.delete('q');
      if (freeOnly) params.set('free', 'true');
      else params.delete('free');
      if (sortKey !== 'name') params.set('sort', sortKey);
      else params.delete('sort');
      return params;
    }, { replace: true });
  }, [selectedProviderId, debouncedSearchQuery, freeOnly, sortKey, setSearchParams]);

  const clearFilters = useCallback(() => {
    setSelectedProviderId('all');
    setSearchQuery('');
    setFreeOnly(false);
    setSortKey('name');
  }, []);

  const hasActiveFilters = useMemo(
    () => selectedProviderId !== 'all' || searchQuery !== '' || freeOnly || sortKey !== 'name',
    [selectedProviderId, searchQuery, freeOnly, sortKey]
  );

  return {
    selectedProviderId,
    setSelectedProviderId,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    freeOnly,
    setFreeOnly,
    sortKey,
    setSortKey,
    clearFilters,
    hasActiveFilters,
  };
}

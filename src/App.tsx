import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useModelRepository, useModelService } from './context/modelRegistry/useModelRegistry';
import { AlternativesModal } from './components/AlternativesModal';
import { VirtualizedModelList } from './components/VirtualizedModelList';
import { SkeletonCard } from './components/SkeletonCard';
import { ErrorBoundary, ModelListFallback, SidebarFallback, ContentHeaderFallback, ModalFallback } from './components/ErrorBoundary';
import { IconWarning, IconClose, IconChevronDown, IconBrand } from './components/icons';
import type { IntelligenceRecord, ExplorerData } from './schemas/api';
import { PROVIDER_LINKS } from './schemas/api';
import { providerId, type ModelId, type ProviderId } from './domain/branded';
import { sanitizeProviderName, sanitizeError } from './utils/sanitize';
import { reportError } from './utils/errorReporting';
import { useAlternativesModal } from './hooks/useAlternativesModal';
import { useFilteredModels } from './hooks/useFilteredModels';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { parseBoolean, parseSortKey, type ProviderFilter, type SortKey } from './types/filters';
import './index.css';

export default function App() {
  const service = useModelService();
  const repository = useModelRepository();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filter state from URL params
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderFilter>(() => {
    const raw = searchParams.get('provider');
    return raw ? providerId(raw) : 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') ?? '');
  const [freeOnly, setFreeOnly] = useState<boolean>(() => parseBoolean(searchParams.get('free')));
  const [sortKey, setSortKey] = useState<SortKey>(() => parseSortKey(searchParams.get('sort')));

  // Debounce the search input so each keystroke does not recompute filters.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 150);

  const [data, setData] = useState<ExplorerData | null>(null);
  const [intelligenceRecords, setIntelligenceRecords] = useState<IntelligenceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Build lookup structures once so filtering/clicks avoid O(n) scans.
  const modelsById = useMemo(() => {
    const map = new Map<ModelId, ExplorerData['models'][number]>();
    for (const model of data?.models ?? []) {
      map.set(model.model_id, model);
    }
    return map;
  }, [data]);

  const intelligenceByModel = useMemo(() => {
    const map = new Map<ModelId, IntelligenceRecord>();
    for (const record of intelligenceRecords) {
      map.set(record.model_id, record);
    }
    return map;
  }, [intelligenceRecords]);

  // Precompute per-provider model counts so sidebar/total avoid O(n) scans.
  const providerCounts = useMemo(() => {
    const counts = new Map<ProviderId, number>();
    for (const model of data?.models ?? []) {
      counts.set(model.provider_id, (counts.get(model.provider_id) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  const { isOpen, originalModel, selectedAlternatives, open, close } = useAlternativesModal();

  // Sync URL params when filter state changes. Uses a functional update so
  // unrelated params (e.g. `alt`) are preserved.
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

  // Keep the `alt` URL param in sync with modal visibility (deep-linkable modal).
  // A fresh deep link arrives with `originalModel === null`, so the param is
  // preserved until the modal opens (or a close removes it) — otherwise the
  // deep-link effect below could never observe it.
  useEffect(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (isOpen && originalModel) params.set('alt', originalModel.model_id);
      else if (!isOpen && originalModel) params.delete('alt');
      return params;
    }, { replace: true });
  }, [isOpen, originalModel, setSearchParams]);

  // Open the modal from an `alt` deep link once the model data is available.
  // Skipped when the URL matches the already-referenced model, so an explicit
  // close (which clears the param) is never immediately overridden.
  useEffect(() => {
    const altId = searchParams.get('alt');
    if (!altId || isOpen) return;
    if (altId === originalModel?.model_id) return;
    const model = modelsById.get(altId as ModelId);
    if (model) {
      const intel = intelligenceByModel.get(model.model_id);
      open(model, intel?.alternatives?.slice(0, 3) ?? []);
    }
  }, [searchParams, modelsById, intelligenceByModel, isOpen, originalModel, open]);

  const loadData = useCallback(async (isRetry = false) => {
    // Serve a fresh cache immediately, then revalidate in the background (SWR).
    if (!isRetry) {
      const cached = repository.getCachedData();
      if (cached) {
        setData(cached.data);
        setIntelligenceRecords(cached.intelligenceRecords);
        setLastUpdated(cached.timestamp);
        setLoading(false);
      }
    }

    if (repository.isCircuitOpen()) {
      setError('Too many failed requests. Please wait before retrying.');
      setLoading(false);
      return;
    }

    try {
      if (isRetry) setLoading(true);
      setError(null);

      const [explorerData, intel] = await Promise.all([
        service.getExplorerData(),
        service.getIntelligenceRecords(),
      ]);

      // Referential integrity: keep only intelligence records that reference
      // models present in the explorer dataset (avoids orphaned alternatives).
      const knownModelIds = new Set(explorerData.models.map((m) => m.model_id));
      const validIntel = intel.filter((i) => knownModelIds.has(i.model_id));

      setData(explorerData);
      setIntelligenceRecords(validIntel);
      setLastUpdated(Date.now());

      repository.writeCache({
        data: explorerData,
        intelligenceRecords: validIntel,
        timestamp: Date.now(),
      });
    } catch (err) {
      // Ignore aborted requests (e.g. triggered by unmount); never surface as errors.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [service, repository]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Abort any in-flight request when the view unmounts.
  useEffect(() => () => repository.abort(), [repository]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
    loadData(true);
  }, [loadData]);

  const handleModelClick = useCallback((modelId: string) => {
    const id = modelId as ModelId;
    const model = modelsById.get(id);
    if (model) {
      const intel = intelligenceByModel.get(id);
      open(model, intel?.alternatives?.slice(0, 3) ?? []);
    }
  }, [modelsById, intelligenceByModel, open]);

  const clearFilters = useCallback(() => {
    setSelectedProviderId('all');
    setSearchQuery('');
    setFreeOnly(false);
    setSortKey('name');
  }, []);

  const hasActiveFilters =
    selectedProviderId !== 'all' || searchQuery !== '' || freeOnly || sortKey !== 'name';

  const { filtered, getTierForModel } = useFilteredModels({
    models: data?.models ?? [],
    intelligenceByModel,
    selectedProviderId,
    searchQuery: debouncedSearchQuery,
    freeOnly,
    sortKey,
  });

  // Arrow-key navigation between sidebar tabs (roving tabindex pattern).
  const handleTabListKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab.focus();
    nextTab.click();
  };

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="brand">
              <IconBrand className="brand-icon" width={22} height={22} />
              <div>
                <div className="brand-name">BaseModel</div>
                <div className="brand-sub">Explorer</div>
              </div>
            </h1>
          </div>
          <div className="sidebar-menu">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="sk-block sk-block-large" />
            ))}
          </div>
        </aside>
        <main className="main-content">
          <div className="content-header">
            <div className="sk-block sk-block-header" />
          </div>
          <div className="content-body">
            {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  // --- Error state ---
  if (error || !data) {
    return (
      <div className="dashboard-layout error-state">
        <div className="error-icon"><IconWarning width={32} height={32} /></div>
        <div className="error-title">Failed to load data</div>
        <div className="error-message">{sanitizeError(error || 'Unknown error. The GitHub API may be unreachable.')}</div>
        <button type="button" className="retry-btn" onClick={retry}>↻ Retry</button>
      </div>
    );
  }

  const activeProvider = selectedProviderId === 'all'
    ? undefined
    : data.providers.find((p) => p.provider_id === selectedProviderId);
  const pageTitle = activeProvider ? activeProvider.name : 'All Providers';
  const total = selectedProviderId === 'all'
    ? data.models.length
    : (providerCounts.get(selectedProviderId) ?? 0);

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <ErrorBoundary fallback={<SidebarFallback onRetry={retry} />} resetKey={retryCount}>
        <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="brand">
            <IconBrand className="brand-icon" width={22} height={22} />
            <div>
              <div className="brand-name">BaseModel</div>
              <div className="brand-sub">Explorer</div>
            </div>
          </h1>
        </div>

        <div
          className="sidebar-menu"
          role="tablist"
          aria-label="Model categories"
          onKeyDown={handleTabListKeyDown}
        >
          <h2 className="menu-section-title">Overview</h2>
          <button
            type="button"
            className={`menu-item ${selectedProviderId === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedProviderId('all')}
            role="tab"
            aria-selected={selectedProviderId === 'all'}
            aria-controls="models-panel"
            id="tab-all"
            tabIndex={selectedProviderId === 'all' ? 0 : -1}
          >
            <span>All Providers</span>
            <span className="menu-badge">{data.models.length}</span>
          </button>

          <h2 className="menu-section-title sidebar-section-title">Providers</h2>
          {data.providers
            .filter((p) => (providerCounts.get(p.provider_id) ?? 0) > 0)
            .sort((a, b) => (providerCounts.get(b.provider_id) ?? 0) - (providerCounts.get(a.provider_id) ?? 0))
            .map((provider) => {
              const modelCount = providerCounts.get(provider.provider_id) ?? 0;
              const link = PROVIDER_LINKS.get(provider.provider_id);
              return (
                <div key={provider.provider_id} className="menu-item-row">
                  <button
                    type="button"
                    className={`menu-item ${selectedProviderId === provider.provider_id ? 'active' : ''}`}
                    onClick={() => setSelectedProviderId(provider.provider_id)}
                    role="tab"
                    aria-selected={selectedProviderId === provider.provider_id}
                    aria-controls="models-panel"
                    id={`tab-${provider.provider_id}`}
                    tabIndex={selectedProviderId === provider.provider_id ? 0 : -1}
                  >
                    <span>{sanitizeProviderName(provider.name)}</span>
                    <span className="menu-badge">{modelCount}</span>
                  </button>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="api-key-link"
                      aria-label={`Get API key for ${sanitizeProviderName(provider.name)}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.071 4.929c-3.905-3.905-10.237-3.905-14.142 0"/><path d="M4.929 19.071c3.905 3.905 10.237 3.905 14.142 0"/><path d="M19.071 19.071c3.905-3.905 3.905-10.237 0-14.142"/><path d="M4.929 4.929C1.024 8.834 1.024 15.166 4.929 19.071"/></svg>
                    </a>
                  )}
                </div>
              );
            })}
        </div>

        <div className="sidebar-footer">
          {lastUpdated && (
            <div className="last-updated" title={new Date(lastUpdated).toLocaleString()}>
              Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <a href="https://github.com/ngodingsendiri/BaseModel" target="_blank" rel="noopener noreferrer" className="gh-link">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
            GitHub
          </a>
        </div>
      </aside>
      </ErrorBoundary>

      {/* Main Content */}
      <main className="main-content">
        <ErrorBoundary fallback={<ContentHeaderFallback onRetry={retry} />} resetKey={retryCount}>
          <div className="content-header">
            <div className="header-left">
              <h2 className="content-title">{pageTitle}</h2>
              <span className="content-count">
                {filtered.length === total
                  ? `${total} models`
                  : `${filtered.length} / ${total} models`}
              </span>
            </div>
            <div className="header-controls">
              <label className="free-toggle" title="Show free models only">
                <input
                  type="checkbox"
                  checked={freeOnly}
                  onChange={(e) => setFreeOnly(e.target.checked)}
                />
                <span>Free only</span>
              </label>

              <label htmlFor="sort-select" className="visually-hidden">Sort by</label>
              <div className="sort-select-wrapper">
                <select
                  id="sort-select"
                  className="sort-select"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="name">Sort: Name</option>
                  <option value="context">Sort: Context ↓</option>
                  <option value="date">Sort: Newest</option>
                </select>
                <IconChevronDown width={12} height={12} />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="clear-filters-btn"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}

              <label htmlFor="search-input" className="visually-hidden">Filter models</label>
              <div className="search-wrap" role="search">
                <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  id="search-input"
                  type="text"
                  className="search-input"
                  placeholder="Filter models…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (searchQuery) setSearchQuery('');
                      else e.currentTarget.blur();
                    }
                  }}
                  aria-label="Filter models"
                />
                {searchQuery && (
                  <button type="button" className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                    <IconClose width={11} height={11} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>

        <div className="content-body" id="models-panel">
          <ErrorBoundary fallback={<ModelListFallback onRetry={retry} />} resetKey={retryCount}>
            <VirtualizedModelList
              models={filtered}
              getTier={getTierForModel}
              onClick={handleModelClick}
              onClearFilters={clearFilters}
              loading={loading}
            />
          </ErrorBoundary>
        </div>
      </main>

      <ErrorBoundary fallback={<ModalFallback onClose={close} />}>
        <AlternativesModal
          isOpen={isOpen}
          onClose={close}
          originalModel={originalModel}
          alternatives={selectedAlternatives}
        />
      </ErrorBoundary>
    </div>
  );
}

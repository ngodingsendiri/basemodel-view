import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ModelDetailModal } from './components/ModelDetailModal';
import { CompareBar } from './components/CompareBar';
import { CompareModal } from './components/CompareModal';
import { VirtualizedModelList } from './components/VirtualizedModelList';
import { SkeletonCard } from './components/SkeletonCard';
import { ErrorBoundary, ModelListFallback, SidebarFallback, ContentHeaderFallback, ModalFallback } from './components/ErrorBoundary';
import { IconWarning, IconClose, IconChevronDown, IconBrand, IconTag, IconClipboard, IconCheck, IconSun, IconMoon, IconMonitor, IconPanelLeft, IconPanelLeftClose, IconDownload, IconMenu } from './components/icons';
import { TIER_CLASS, MODALITY_LABEL, benchmarkLabel } from './components/ui/constants';
import { PROVIDER_LINKS } from './config/providers';
import type { ModelId } from './domain/branded';
import type { SortKey } from './types/filters';
import { rankBenchmarkFromKey } from './types/filters';

import { useModelDetailModal } from './hooks/useModelDetailModal';
import { useCompare } from './hooks/useCompare';
import { useExplorerData } from './hooks/useExplorerData';
import { useFilters } from './hooks/useFilters';
import { useFilteredModels } from './hooks/useFilteredModels';
import { useTheme } from './hooks/useTheme';
import './index.css';

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  };
  return (
    <>
      <button
        type="button"
        className="share-link-btn"
        onClick={copy}
        title={copied ? 'Copied' : 'Copy link with current filters'}
        aria-label={copied ? 'Copied' : 'Copy link with current filters'}
      >
        {copied ? <IconCheck width={12} height={12} /> : <IconClipboard width={12} height={12} />}
        <span className="btn-label">{copied ? 'Copied' : 'Copy link'}</span>
      </button>
      <span role="status" className="visually-hidden" aria-live="polite">
        {copied ? 'Link copied' : ''}
      </span>
    </>
  );
}

const NETWORK_ERROR_HINTS = [
  'failed to fetch',
  'networkerror',
  'load failed',
  'cors',
  'network request failed',
  'unexpected token',
];

/** Turn a raw exception message into a calm, human-readable error line. */
function friendlyErrorMessage(raw: string | null | undefined): string {
  if (!raw) return 'The model catalog could not be loaded. Please try again.';
  const lowered = raw.toLowerCase();
  if (lowered.includes('too many failed requests')) return raw;
  if (NETWORK_ERROR_HINTS.some((hint) => lowered.includes(hint))) {
    return 'Could not reach the data source. Check your internet connection and try again.';
  }
  return 'Something went wrong while loading the model catalog. Please try again.';
}

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    data,
    error,
    loading,
    lastUpdated,
    retryCount,
    retry,
    modelsById,
    offeringsByModel,
    pricingByModel,
    modelIdsByProvider,
    rankingByModel,
    modelByOfferingId,
    newModelIds,
    providerCounts,
    benchmarksByModel,
    benchmarkSummary,
  } = useExplorerData();

  const {
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
  } = useFilters();

  const [compareOpen, setCompareOpen] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  // Sidebar provider search — a local navigation aid, deliberately NOT a URL param.
  const [providerQuery, setProviderQuery] = useState('');
  const sidebarMobileRef = useRef<HTMLElement | null>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement | null>(null);

  const { mode, effectiveTheme, cycle } = useTheme();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('bm-sidebar') === 'collapsed'
  );
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('bm-sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
  }, []);

  const toggleSidebarMobile = useCallback(() => {
    setSidebarMobileOpen((prev) => !prev);
  }, []);

  // Brand click = go home (reset provider + close the mobile drawer).
  const goHome = useCallback(() => {
    setSelectedProviderId('all');
    setSidebarMobileOpen(false);
    setProviderQuery('');
  }, [setSelectedProviderId]);

  // Benchmark names present in the dataset — the Ranking sort options are
  // derived from these, so new benchmarks appear automatically.
  const benchmarkNames = useMemo(
    () => new Set(benchmarkSummary.map((b) => b.name)),
    [benchmarkSummary]
  );

  // A deep link may reference a benchmark that no longer exists in the data;
  // fall back to name order instead of rendering a dead sort option.
  const effectiveSortKey = useMemo<SortKey>(() => {
    const rankName = rankBenchmarkFromKey(sortKey);
    return !rankName || benchmarkNames.has(rankName) ? sortKey : 'name';
  }, [sortKey, benchmarkNames]);

  const getBenchmarkScores = useCallback(
    (modelId: ModelId) => {
      const scores = benchmarksByModel.get(modelId);
      if (!scores || scores.size === 0) return [];
      return [...scores.entries()].map(([name, s]) => ({ name, score: s.score, rank: s.rank }));
    },
    [benchmarksByModel]
  );

  const visibleProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    return (data?.providers ?? [])
      .filter((p) => (providerCounts.get(p.provider_id) ?? 0) > 0)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => (providerCounts.get(b.provider_id) ?? 0) - (providerCounts.get(a.provider_id) ?? 0));
  }, [data, providerCounts, providerQuery]);

  // Close the mobile sidebar drawer on Escape, returning focus to the toggle.
  useEffect(() => {
    if (!sidebarMobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarMobileOpen(false);
        sidebarToggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sidebarMobileOpen]);

  // Move focus into the drawer when it opens (a11y).
  useEffect(() => {
    if (!sidebarMobileOpen) return;
    sidebarMobileRef.current?.querySelector<HTMLElement>('.menu-item')?.focus();
  }, [sidebarMobileOpen]);

  // Auto-close the drawer when the viewport grows past the mobile breakpoint,
  // otherwise a fixed backdrop would keep blocking the UI on desktop.
  useEffect(() => {
    if (!sidebarMobileOpen) return;
    const mq = window.matchMedia('(min-width: 769px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarMobileOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [sidebarMobileOpen]);

  // Keep the sidebar header's height in lockstep with the content header so
  // their divider lines stay perfectly aligned at every window size (the
  // content header grows to two rows on compact widths).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const el = document.querySelector<HTMLElement>('.content-header');
    if (!el || !mq.matches) return;
    const apply = () => {
      const h = el.offsetHeight;
      if (h > 0) document.documentElement.style.setProperty('--header-h', `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    const onMq = (e: MediaQueryListEvent) => {
      if (e.matches) apply();
      else document.documentElement.style.removeProperty('--header-h');
    };
    mq.addEventListener('change', onMq);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', onMq);
    };
  }, [loading, error, data]);

  const { isOpen, model, offerings, open, close } = useModelDetailModal();

  // Keep the `alt` URL param in sync with modal visibility (deep-linkable modal).
  // Opening pushes a history entry so the Back button returns to the list and
  // closes the modal; everything else (deep-link open, model switch, close)
  // replaces in place so the history is not spammed.
  const wasOpenRef = useRef(false);
  const lastAltParamRef = useRef<string | null>(searchParams.get('alt'));
  useEffect(() => {
    const currentAlt = searchParams.get('alt');
    const openedNow = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    // The `alt` param vanished while the modal was open without an explicit
    // close — the user pressed Back/forward. Close the modal and do NOT rewrite
    // the param (otherwise the sync below would undo the navigation).
    if (isOpen && !openedNow && lastAltParamRef.current != null && currentAlt == null) {
      lastAltParamRef.current = null;
      close();
      return;
    }

    const targetAlt = isOpen && model ? model.model_id : null;
    const shouldDelete = !isOpen && model;
    if (!shouldDelete && targetAlt === currentAlt && lastAltParamRef.current === currentAlt) {
      lastAltParamRef.current = currentAlt;
      return; // already in sync
    }

    const alreadyLinked = targetAlt != null && currentAlt === targetAlt;
    const pushHistory = openedNow && !alreadyLinked;
    lastAltParamRef.current = currentAlt;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (isOpen && model) params.set('alt', model.model_id);
      else if (!isOpen && model) params.delete('alt');
      return params;
    }, { replace: !pushHistory });
  }, [isOpen, model, searchParams, setSearchParams, close]);

  // Open the modal from an `alt` deep link once the model data is available.
  // Accepts canonical model ids and legacy offering ids (provider/slug).
  // Skipped when the URL matches the already-referenced model, so an explicit
  // close (which clears the param) is never immediately overridden.
  useEffect(() => {
    const altId = searchParams.get('alt');
    if (!altId || isOpen) return;
    if (altId === model?.model_id) return;
    const canonicalId = modelsById.has(altId as ModelId)
      ? (altId as ModelId)
      : modelByOfferingId.get(altId);
    const target = canonicalId ? modelsById.get(canonicalId) : undefined;
    if (target) {
      open(target, offeringsByModel.get(target.model_id) ?? []);
    }
  }, [searchParams, modelsById, modelByOfferingId, offeringsByModel, isOpen, model, open]);

  const handleModelClick = useCallback((modelId: string) => {
    const id = modelId as ModelId;
    const target = modelsById.get(id);
    if (target) {
      open(target, offeringsByModel.get(id) ?? []);
    }
  }, [modelsById, offeringsByModel, open]);

  const { filtered, getTierForModel, getPriceForModel, getProviderCount, getBenchmarkScore, rankBenchmark } = useFilteredModels({
    models: data?.models ?? [],
    providers: data?.providers ?? [],
    offeringsByModel,
    pricingByModel,
    modelIdsByProvider,
    rankingByModel,
    benchmarksByModel,
    selectedProviderId,
    searchQuery: debouncedSearchQuery,
    freeOnly,
    sortKey: effectiveSortKey,
  });

  // Provider display names serving each canonical model (compare table).
  const providerNameById = useMemo(
    () => new Map((data?.providers ?? []).map((p) => [p.provider_id, p.name])),
    [data?.providers]
  );
  const getProviderNames = useCallback((modelId: string): string[] => {
    return (offeringsByModel.get(modelId as ModelId) ?? [])
      .map((o) => providerNameById.get(o.provider_id) ?? o.provider_id);
  }, [providerNameById, offeringsByModel]);

  const compareUrlSeed = useMemo<ModelId[]>(() => {
    const raw = searchParams.get('compare');
    if (!raw) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean) as ModelId[];
  }, [searchParams]);

  const compare = useCompare(data?.models ?? [], compareUrlSeed);

  // Persist the compare selection to the URL so it survives a reload, matching
  // the other filter state. Other params are preserved via functional update.
  // While a deep-link seed is still pending (data not loaded yet) the param is
  // left untouched, otherwise the empty selection would wipe it before the
  // seed effect can read it.
  useEffect(() => {
    if (!compare.seedApplied && searchParams.get('compare')) return;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      const ids = Array.from(compare.selected).map(String).sort();
      if (ids.length > 0) params.set('compare', ids.join(','));
      else params.delete('compare');
      return params;
    }, { replace: true });
  }, [compare.selected, compare.seedApplied, searchParams, setSearchParams]);

  // Global shortcut: "/" focuses the search box (unless already typing).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Export the current (filtered) view to a CSV file.
  const exportCsv = useCallback(() => {
    const header = ['Name', 'Model ID', 'Providers', 'Tier', 'Cheapest per 1M', 'Quality', 'Context', 'Release', 'Modalities', 'Description'];
    // Quote-escape, and neutralize formula prefixes (= + - @) so upstream text
    // can never execute as a formula when opened in a spreadsheet (CSV injection).
    const esc = (v: string | number | undefined | null) => {
      let s = String(v ?? '').replace(/"/g, '""');
      if (/^[=+@-]/.test(s)) s = `'${s}`;
      return `"${s}"`;
    };
    const rows = filtered.map((m) => [
      esc(m.name),
      esc(m.model_id),
      esc(getProviderNames(m.model_id).join('; ')),
      esc(getTierForModel(m.model_id)),
      esc(getPriceForModel(m.model_id)),
      esc(m.quality?.score),
      esc(m.context_window),
      esc(m.release_date),
      esc((m.modality ?? []).join(' ')),
      esc(m.description),
    ]);
    const csv = [header.map(esc).join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `basemodel-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [filtered, getProviderNames, getTierForModel, getPriceForModel]);

  // --- Loading skeleton (only when nothing to render yet) ---
  if (loading && !data) {
    return (
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="brand">
              <button type="button" className="brand-btn" onClick={goHome} aria-label="Go to home" title="Go to all providers">
                <IconBrand className="brand-icon" width={22} height={22} />
                <span className="brand-text">
                  <span className="brand-name">BaseModel</span>
                  <span className="brand-sub">Explorer</span>
                </span>
              </button>
            </h1>
            <div className="sk-block sk-block-icon" />
          </div>
          <div className="sidebar-menu">
            <div className="sk-block sk-block-large" />
            <div className="sk-block sk-block-search-sm" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="sk-block sk-block-large" />
            ))}
          </div>
        </aside>
        <main className="main-content">
          <div className="content-header">
            <div className="header-left">
              <div className="sk-block sk-block-title" />
            </div>
            <div className="search-wrap">
              <div className="sk-block sk-block-search" />
            </div>
            <div className="header-controls">
              <div className="sk-block sk-block-chip" />
              <div className="sk-block sk-block-chip" />
              <div className="sk-block sk-block-chip" />
              <div className="sk-block sk-block-chip" />
            </div>
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
        <div className="error-message">{friendlyErrorMessage(error)}</div>
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
    <div className={`dashboard-layout${compare.selectedModels.length > 0 ? ' has-compare-bar' : ''}`}>
      <a href="#models-panel" className="skip-link">
        Skip to content
      </a>

      {sidebarMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => {
            setSidebarMobileOpen(false);
            sidebarToggleRef.current?.focus();
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <ErrorBoundary fallback={<SidebarFallback onRetry={retry} />} resetKey={retryCount}>
        <aside ref={sidebarMobileRef} className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}${sidebarMobileOpen ? ' sidebar--mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="brand">
            <button type="button" className="brand-btn" onClick={goHome} aria-label="Go to home" title="Go to all providers">
              <IconBrand className="brand-icon" width={22} height={22} />
              <span className="brand-text">
                <span className="brand-name">BaseModel</span>
                <span className="brand-sub">Explorer</span>
              </span>
            </button>
          </h1>
          <button
            type="button"
            className="icon-btn sidebar-collapse-btn"
            onClick={toggleSidebar}
            data-tooltip={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed
              ? <IconPanelLeftClose width={15} height={15} />
              : <IconPanelLeft width={15} height={15} />}
          </button>
        </div>

        <div
          className="sidebar-menu"
          role="navigation"
          aria-label="Model categories"
        >
          <h2 className="menu-section-title">Overview</h2>
          <button
            type="button"
            className={`menu-item ${selectedProviderId === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedProviderId('all')}
            aria-current={selectedProviderId === 'all' ? 'page' : undefined}
            aria-label="All Providers"
            title="All Providers"
          >
            <span className="menu-avatar" aria-hidden="true">AL</span>
            <span className="menu-label">All Providers</span>
            <span className="menu-badge" aria-hidden="true">{data.models.length}</span>
          </button>

          <h2 className="menu-section-title sidebar-section-title">
            Providers <span className="provider-count" aria-hidden="true">{visibleProviders.length}</span>
          </h2>
          <input
            type="search"
            className="provider-search"
            placeholder={`Search ${visibleProviders.length} providers…`}
            value={providerQuery}
            onChange={(e) => setProviderQuery(e.target.value)}
            aria-label="Search providers"
          />
          {visibleProviders.length === 0 ? (
            <div className="sidebar-empty">No providers match “{providerQuery}”.</div>
          ) : (
            visibleProviders.map((provider) => {
              const modelCount = providerCounts.get(provider.provider_id) ?? 0;
              const link = PROVIDER_LINKS.get(provider.provider_id);
              return (
                <div key={provider.provider_id} className="menu-item-row">
                  <button
                    type="button"
                    className={`menu-item ${selectedProviderId === provider.provider_id ? 'active' : ''}`}
                    onClick={() => setSelectedProviderId(provider.provider_id)}
                    aria-current={selectedProviderId === provider.provider_id ? 'page' : undefined}
                    aria-label={provider.name}
                    title={provider.name}
                  >
                    <span className="menu-avatar" aria-hidden="true">
                      {provider.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '?'}
                    </span>
                    <span className="menu-label">{provider.name}</span>
                    <span className="menu-badge" aria-hidden="true">{modelCount}</span>
                  </button>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="api-key-link"
                      aria-label={`Get API key for ${provider.name}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.071 4.929c-3.905-3.905-10.237-3.905-14.142 0"/><path d="M4.929 19.071c3.905 3.905 10.237 3.905 14.142 0"/><path d="M19.071 19.071c3.905-3.905 3.905-10.237 0-14.142"/><path d="M4.929 4.929C1.024 8.834 1.024 15.166 4.929 19.071"/></svg>
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-legend">
            <h3 className="legend-title">Legend</h3>
            <div className="legend-group">
              <span className="legend-label">Tier</span>
              <div className="legend-items">
                {Object.keys(TIER_CLASS).map((t) => (
                  <span key={t} className="legend-item" title={`${t} price tier`}>
                    <span className={`legend-swatch ${TIER_CLASS[t]}`} aria-hidden="true" />
                    {t === 'Free' && <IconTag width={10} height={10} aria-hidden="true" />}
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="legend-group">
              <span className="legend-label">Modality</span>
              <div className="legend-items">
                {Object.entries(MODALITY_LABEL).map(([key, label]) => (
                  <span key={key} className="legend-item legend-item--modality" title={key}>
                    <span className="modality-chip">{label}</span>
                    <span className="legend-modality-name">{key}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
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
      <main className="main-content" aria-busy={loading && !!data}>
        <ErrorBoundary fallback={<ContentHeaderFallback onRetry={retry} />} resetKey={retryCount}>
          <div className="content-header">
            <div className="header-left">
              <button
                type="button"
                ref={sidebarToggleRef}
                className="icon-btn sidebar-mobile-toggle"
                aria-expanded={sidebarMobileOpen}
                onClick={toggleSidebarMobile}
                aria-label={sidebarMobileOpen ? 'Close sidebar' : 'Open sidebar'}
                data-tooltip={sidebarMobileOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                <IconMenu width={15} height={15} />
              </button>
              <h2 className="content-title">{pageTitle}</h2>
              <span className="content-count" role="status" aria-live="polite">
                {filtered.length === total
                  ? `${total} models`
                  : `${filtered.length} / ${total} models`}
              </span>
              {loading && (
                <span className="refresh-indicator" role="status" aria-live="polite">
                  <span className="refresh-spinner" aria-hidden="true" />
                  Refreshing…
                </span>
              )}
            </div>

            <div className="search-wrap" role="search">
              <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                id="search-input"
                type="text"
                className="search-input"
                placeholder="Search models…"
                title="Press / to focus search"
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
                  value={effectiveSortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="name">Name (A–Z)</option>
                  <option value="quality">Quality: best first</option>
                  <option value="context">Context: largest</option>
                  <option value="date">Newest first</option>
                  <option value="price">Price: cheapest</option>
                  {benchmarkSummary.length > 0 && (
                    <optgroup label="Ranking">
                      {benchmarkSummary.map(({ name }) => (
                        <option key={name} value={`rank:${name}`}>
                          Ranking: {benchmarkLabel(name)}
                        </option>
                      ))}
                    </optgroup>
                  )}
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

              <CopyLinkButton />

              <button
                type="button"
                className="export-btn"
                onClick={exportCsv}
                disabled={filtered.length === 0}
                title={filtered.length === 0 ? 'Nothing to export' : `Export ${filtered.length} models to CSV`}
              >
                <IconDownload width={12} height={12} />
                <span className="btn-label">Export CSV</span>
              </button>

              <button
                type="button"
                className="icon-btn"
                onClick={cycle}
                data-tooltip={`Theme: ${effectiveTheme} — switch light/dark/system`}
                aria-label={`Theme: ${effectiveTheme}. Switch light, dark, or system`}
              >
                {mode === 'system'
                  ? <IconMonitor width={15} height={15} />
                  : mode === 'light'
                    ? <IconSun width={15} height={15} />
                    : <IconMoon width={15} height={15} />}
              </button>
            </div>
          </div>
        </ErrorBoundary>

        <div className="content-body" id="models-panel" tabIndex={-1}>
          <ErrorBoundary fallback={<ModelListFallback onRetry={retry} />} resetKey={retryCount}>
            <VirtualizedModelList
              models={filtered}
              getTier={getTierForModel}
              getPrice={getPriceForModel}
              getProviderCount={getProviderCount}
              rankingByModel={rankingByModel}
              newModelIds={newModelIds}
              rankBenchmark={rankBenchmark}
              getBenchmarkScore={getBenchmarkScore}
              compareSelected={compare.selected}
              compareDisabled={compare.isFull}
              onToggleCompare={compare.toggle}
              onClick={handleModelClick}
              onClearFilters={clearFilters}
              loading={loading && !data}
            />
          </ErrorBoundary>
        </div>
      </main>

      <ErrorBoundary fallback={<ModalFallback onClose={close} />}>
        <ModelDetailModal
          isOpen={isOpen}
          onClose={close}
          model={model}
          offerings={offerings}
          providers={data.providers}
          pricing={model ? pricingByModel.get(model.model_id) : undefined}
          ranking={model ? rankingByModel.get(model.model_id) : undefined}
          isNew={model ? newModelIds.has(model.model_id) : false}
          benchmarks={model ? getBenchmarkScores(model.model_id) : []}
        />
      </ErrorBoundary>

      {compare.selectedModels.length > 0 && (
        <CompareBar
          count={compare.selectedModels.length}
          onCompare={() => setCompareOpen(true)}
          onClear={compare.clear}
          isFull={compare.isFull}
          max={compare.maxCompare}
        />
      )}

      {compareOpen && compare.selectedModels.length > 0 && (
        <ErrorBoundary fallback={<ModalFallback onClose={() => setCompareOpen(false)} />}>
          <CompareModal
            models={compare.selectedModels}
            getProviderNames={getProviderNames}
            getTier={getTierForModel}
            getPrice={getPriceForModel}
            getBenchmarkScore={getBenchmarkScore}
            benchmarkNames={benchmarkSummary.map((b) => b.name)}
            onClose={() => setCompareOpen(false)}
            onRemove={compare.toggle}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Model, BenchmarkScore } from '../types';
import { ModelCard } from './ModelCard';
import { SkeletonCard } from './SkeletonCard';
import { IconBox, IconChevronUp } from './icons';

const MIN_CARD_WIDTH = 300;
const CARD_GAP = 8;
const LOADING_CARD_COUNT = 12;

interface VirtualizedModelListProps {
  models: Model[];
  getTier: (modelId: string) => string;
  getPrice?: (modelId: string) => number | undefined;
  /** Active ranking benchmark name when sorted by rank (e.g. "code"). */
  rankBenchmark?: string | null;
  getBenchmarkScore?: (modelId: string, name: string) => BenchmarkScore | undefined;
  compareSelected?: ReadonlySet<string>;
  /** Disables adding new models once the comparison cap is reached. */
  compareDisabled?: boolean;
  onToggleCompare?: (modelId: string) => void;
  onClick: (modelId: string) => void;
  onClearFilters?: () => void;
  loading?: boolean;
}

export function VirtualizedModelList({
  models,
  getTier,
  getPrice,
  rankBenchmark,
  getBenchmarkScore,
  compareSelected,
  compareDisabled,
  onToggleCompare,
  onClick,
  onClearFilters,
  loading = false,
}: VirtualizedModelListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [showTopBtn, setShowTopBtn] = useState(false);

  // Reset the scroll position whenever the visible model set changes (provider
  // switch, search, sort, free-only), so users always start from the top of a
  // new view instead of landing mid-list. useLayoutEffect runs before paint so
  // the old scroll offset never flashes on screen.
  const renderedSetRef = useRef(models);
  useLayoutEffect(() => {
    if (renderedSetRef.current !== models) {
      renderedSetRef.current = models;
      const el = parentRef.current;
      if (el && el.scrollTop !== 0) el.scrollTo({ top: 0 });
    }
  }, [models]);

  // Track scroll depth to reveal the "back to top" affordance.
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => setShowTopBtn(el.scrollTop > 600);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Derive column count from the actual scroll-container width so the
  // virtualized grid reflows with the viewport.
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      setColumns(Math.max(1, Math.floor((width + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP))));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Chunk the flat model list into rows of `columns` cards so each virtual
  // item renders one CSS grid row.
  const rows = useMemo(() => {
    const out: Model[][] = [];
    for (let i = 0; i < models.length; i += columns) {
      out.push(models.slice(i, i + columns));
    }
    return out;
  }, [models, columns]);

  const loadingRows = Math.max(1, Math.ceil(LOADING_CARD_COUNT / columns));

  const scrollToTop = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);

  const virtualizer = useVirtualizer({
    count: loading ? loadingRows : rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 76, []),
    gap: CARD_GAP,
    overscan: 4,
  });

  const rowGridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  if (loading) {
    return (
      <div ref={parentRef} className="virtualized-list" role="list" aria-label="Model list" aria-busy="true">
        <div className="virtualized-list-inner" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="virtualized-row"
              role="listitem"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div className="virtualized-row-inner" style={rowGridStyle}>
                {Array.from({ length: columns }, (_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div ref={parentRef} className="virtualized-list virtualized-empty">
        <div className="empty-state">
          <div className="empty-icon"><IconBox width={24} height={24} /></div>
          <div>No models match your filters.</div>
          {onClearFilters && (
            <button type="button" className="empty-state-action" onClick={onClearFilters}>
              Clear all filters
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="virtualized-list" role="list" aria-label="Model list" aria-busy={loading || undefined}>
      <div className="virtualized-list-inner" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return (
            <div
              key={virtualRow.index}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="virtualized-row"
              role="listitem"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div className="virtualized-row-inner" style={rowGridStyle}>
                {row.map((model) => (
                  <ModelCard
                    key={model.model_id}
                    model={model}
                    tier={getTier(model.model_id)}
                    price={getPrice?.(model.model_id)}
                    rank={
                      rankBenchmark ? getBenchmarkScore?.(model.model_id, rankBenchmark) : undefined
                    }
                    rankBenchmarkName={rankBenchmark ?? undefined}
                    compareSelected={compareSelected?.has(model.model_id)}
                    compareDisabled={compareDisabled}
                    onToggleCompare={onToggleCompare}
                    onClick={onClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {showTopBtn && (
        <button type="button" className="scroll-top-btn" onClick={scrollToTop} aria-label="Scroll to top">
          <IconChevronUp width={14} height={14} />
        </button>
      )}
    </div>
  );
}

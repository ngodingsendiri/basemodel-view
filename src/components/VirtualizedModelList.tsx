import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Model } from '../types';
import { ModelCard } from './ModelCard';
import { SkeletonCard } from './SkeletonCard';
import { IconBox } from './icons';

const MIN_CARD_WIDTH = 300;
const CARD_GAP = 8;
const LOADING_CARD_COUNT = 12;

interface VirtualizedModelListProps {
  models: Model[];
  getTier: (modelId: string) => string;
  getPrice?: (modelId: string) => number | undefined;
  compareSelected?: ReadonlySet<string>;
  onToggleCompare?: (modelId: string) => void;
  onClick: (modelId: string) => void;
  onClearFilters?: () => void;
  loading?: boolean;
}

export function VirtualizedModelList({
  models,
  getTier,
  getPrice,
  compareSelected,
  onToggleCompare,
  onClick,
  onClearFilters,
  loading = false,
}: VirtualizedModelListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

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

  const virtualizer = useVirtualizer({
    count: loading ? loadingRows : rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 88, []),
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
                    compareSelected={compareSelected?.has(model.model_id)}
                    onToggleCompare={onToggleCompare}
                    onClick={onClick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

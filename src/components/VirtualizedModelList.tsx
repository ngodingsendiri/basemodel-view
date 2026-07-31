import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useCallback } from 'react';
import type { Model } from '../types';
import { ModelCard } from './ModelCard';
import { SkeletonCard } from './SkeletonCard';
import { IconBox } from './icons';

interface VirtualizedModelListProps {
  models: Model[];
  getTier: (modelId: string) => string;
  onClick: (modelId: string) => void;
  loading?: boolean;
}

export function VirtualizedModelList({
  models,
  getTier,
  onClick,
  loading = false,
}: VirtualizedModelListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const measureElement = useCallback((index: number): number => {
    const element = itemRefs.current.get(index);
    if (element) {
      return element.getBoundingClientRect().height;
    }
    // Fallback estimate based on content (compact card)
    const model = models[index];
    if (!model) return 96;
    const modalityCount = model.modality?.length ?? 0;
    const metaLines = Math.ceil((1 + modalityCount) / 4);
    // Base height + wrapping meta line when many modality pills exist
    return 84 + Math.max(0, metaLines - 1) * 18;
  }, [models]);

  const virtualizer = useVirtualizer({
    count: loading ? 12 : models.length,
    getScrollElement: () => parentRef.current,
    estimateSize: measureElement,
    gap: 8,
    overscan: 5,
  });

  const setItemRef = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(index, element);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  if (loading) {
    return (
      <div ref={parentRef} className="virtualized-list">
        <div className="virtualized-list-inner" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              ref={(el) => setItemRef(virtualRow.index, el)}
              className="virtualized-item"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
              }}
            >
              <SkeletonCard />
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
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="virtualized-list">
      <div className="virtualized-list-inner" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const model = models[virtualRow.index];
          return (
            <div
              key={model.model_id}
              ref={(el) => setItemRef(virtualRow.index, el)}
              className="virtualized-item"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                height: `${virtualRow.size}px`,
              }}
            >
              <ModelCard
                model={model}
                tier={getTier(model.model_id)}
                onClick={onClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
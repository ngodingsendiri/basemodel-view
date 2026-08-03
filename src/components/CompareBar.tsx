interface CompareBarProps {
  count: number;
  onCompare: () => void;
  onClear: () => void;
  /** True when the comparison cap has been reached. */
  isFull?: boolean;
  /** Maximum number of comparable models. */
  max?: number;
}

export function CompareBar({ count, onCompare, onClear, isFull = false, max }: CompareBarProps) {
  const canCompare = count >= 2;
  return (
    <div className="compare-bar" role="group" aria-label="Compare bar">
      <span className="compare-bar-count" role="status" aria-live="polite">
        {count} selected
        {count === 1 && <span className="compare-bar-hint"> · pick one more to compare</span>}
        {isFull && <span className="compare-bar-hint"> · max {max} reached</span>}
      </span>
      <button
        type="button"
        className="compare-bar-btn"
        onClick={onCompare}
        disabled={!canCompare}
        title={canCompare ? 'Open comparison' : 'Select at least 2 models to compare'}
      >
        Compare ({count})
      </button>
      <button type="button" className="compare-bar-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

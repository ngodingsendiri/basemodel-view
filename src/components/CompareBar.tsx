interface CompareBarProps {
  count: number;
  onCompare: () => void;
  onClear: () => void;
}

export function CompareBar({ count, onCompare, onClear }: CompareBarProps) {
  const canCompare = count >= 2;
  return (
    <div className="compare-bar" role="status" aria-live="polite">
      <span className="compare-bar-count">
        {count} selected
        {count === 1 && <span className="compare-bar-hint"> · pick one more to compare</span>}
      </span>
      <button
        type="button"
        className="compare-bar-btn"
        onClick={onCompare}
        disabled={!canCompare}
        title={canCompare ? 'Open comparison' : 'Select at least 2 models to compare'}
        aria-disabled={!canCompare}
      >
        Compare ({count})
      </button>
      <button type="button" className="compare-bar-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

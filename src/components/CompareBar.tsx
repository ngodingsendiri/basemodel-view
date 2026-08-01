interface CompareBarProps {
  count: number;
  onCompare: () => void;
  onClear: () => void;
}

export function CompareBar({ count, onCompare, onClear }: CompareBarProps) {
  return (
    <div className="compare-bar" role="status" aria-live="polite">
      <span className="compare-bar-count">{count} selected</span>
      <button
        type="button"
        className="compare-bar-btn"
        onClick={onCompare}
        disabled={count < 2}
      >
        Compare ({count})
      </button>
      <button type="button" className="compare-bar-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

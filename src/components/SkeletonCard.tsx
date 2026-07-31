export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="sk-row sk-row-space-between">
        <div>
          <div className="sk-block sk-block-name" />
          <div className="sk-block sk-block-id" />
        </div>
      </div>
      <div className="sk-row sk-row-gap">
        <div className="sk-block sk-block-ctx" />
        <div className="sk-block sk-block-date" />
      </div>
      <div className="sk-row sk-row-footer">
        <div className="sk-row-footer-inner">
          <div className="sk-block sk-block-modality" />
          <div className="sk-block sk-block-modality" />
        </div>
        <div className="sk-block sk-block-tier" />
      </div>
    </div>
  );
}
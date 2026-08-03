export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="sk-row sk-row-space-between">
        <div className="sk-block sk-block-name" />
        <div className="sk-block sk-block-tier" />
      </div>
      <div className="sk-row sk-row-gap">
        <div className="sk-block sk-block-ctx" />
        <div className="sk-block sk-block-date" />
        <div className="sk-block sk-block-modality" />
        <div className="sk-block sk-block-modality" />
      </div>
    </div>
  );
}

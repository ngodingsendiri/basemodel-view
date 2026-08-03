import { useEffect, useState } from 'react';
import type { Model, Alternative } from '../schemas/api';
import { useModal } from '../hooks/useModal';
import { formatCtx, formatReleaseDate, formatCost, displayModelName } from '../utils/format';
import { copyText } from '../utils/clipboard';
import { TIER_CLASS, benchmarkLabel } from './ui/constants';
import { IconClose, IconExternal } from './icons';

interface AlternativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalModel: Model | null;
  alternatives: Alternative[];
  onSelectAlternative?: (modelId: string) => void;
  getPrice?: (modelId: string) => number | undefined;
  /** Display name of the owning provider (from the providers dataset). */
  providerName?: string;
  /** Optional link to the provider's dashboard / API console. */
  providerLink?: string;
  /** Pricing tier label for the original model. */
  tier?: string;
  /** Benchmark scores/ranks available for the original model. */
  benchmarks?: { name: string; score: number; rank: number }[];
}

const modalTitleId = 'alternatives-modal-title';
const INITIAL_VISIBLE = 3;

function CopyIDBtn({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    copyText(id).then((ok) => {
      setCopied(ok);
      if (ok) setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy model ID'}
        title={copied ? 'Copied' : 'Copy model ID'}
        className="copy-btn"
      >
        {copied ? 'copied' : 'copy'}
      </button>
      <span role="status" className="visually-hidden" aria-live="polite">
        {copied ? 'Copied model ID' : ''}
      </span>
    </>
  );
}

export function AlternativesModal({
  isOpen,
  onClose,
  originalModel,
  alternatives,
  onSelectAlternative,
  getPrice,
  providerName,
  providerLink,
  tier,
  benchmarks = [],
}: AlternativesModalProps) {
  const modalRef = useModal(isOpen && !!originalModel, onClose);
  const [showAll, setShowAll] = useState(false);
  const visibleAlternatives = showAll ? alternatives : alternatives.slice(0, INITIAL_VISIBLE);
  const hiddenCount = alternatives.length - visibleAlternatives.length;

  useEffect(() => {
    setShowAll(false);
  }, [originalModel?.model_id]);

  if (!isOpen || !originalModel) return null;

  const price = getPrice?.(originalModel.model_id);
  const context = originalModel.context_window;
  const maxOutput = originalModel.max_output_tokens;
  const releaseDate = formatReleaseDate(originalModel.release_date);
  const modalities = originalModel.modality ?? [];

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="close-button"
          onClick={onClose}
          aria-label="Close modal"
        >
          <IconClose width={14} height={14} />
        </button>

        <div className="modal-header">
          <h2 id={modalTitleId} className="modal-title">
            {displayModelName(originalModel.name)}
          </h2>
          {providerName && (
            <div className="modal-provider">
              {providerLink ? (
                <a
                  href={providerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-provider-link"
                >
                  {providerName}
                  <IconExternal width={10} height={10} />
                </a>
              ) : (
                <span className="modal-provider-name">{providerName}</span>
              )}
            </div>
          )}
          <div className="modal-model-id">
            <code>{originalModel.model_id}</code>
            <CopyIDBtn id={originalModel.model_id} />
          </div>
        </div>

        {originalModel.description && (
          <p className="modal-description">{originalModel.description}</p>
        )}

        <div className="modal-specs">
          {tier && (
            <div className="spec-item">
              <span className="spec-label">Tier</span>
              <span className={`tier-badge ${TIER_CLASS[tier] ?? 'badge-tier-unknown'}`}>{tier}</span>
            </div>
          )}
          {context != null && (
            <div className="spec-item">
              <span className="spec-label">Context</span>
              <span className="spec-value">{formatCtx(context)} tokens</span>
            </div>
          )}
          {maxOutput != null && (
            <div className="spec-item">
              <span className="spec-label">Max output</span>
              <span className="spec-value">{formatCtx(maxOutput)} tokens</span>
            </div>
          )}
          {releaseDate && (
            <div className="spec-item">
              <span className="spec-label">Released</span>
              <span className="spec-value">{releaseDate}</span>
            </div>
          )}
          <div className="spec-item">
            <span className="spec-label">Price /1M</span>
            <span className="spec-value">
              {price === undefined ? '—' : price === 0 ? 'Free' : `${formatCost(price)} /1M`}
            </span>
          </div>
          {modalities.length > 0 && (
            <div className="spec-item">
              <span className="spec-label">Modalities</span>
              <span className="spec-value spec-value--modalities">
                {modalities.map((m) => (
                  <span key={m} className="modality-chip">{m.toUpperCase()}</span>
                ))}
              </span>
            </div>
          )}
          {benchmarks.length > 0 && (
            <div className="spec-item spec-item--benchmarks">
              <span className="spec-label">Rankings</span>
              <span className="spec-value spec-value--benchmarks">
                {benchmarks.map((b) => (
                  <span
                    key={b.name}
                    className="bench-chip"
                    title={`Ranked #${b.rank} on ${benchmarkLabel(b.name)} (score ${b.score})`}
                  >
                    {benchmarkLabel(b.name)} #{b.rank} · {b.score}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="alt-list">
          <h3 className="alt-list-title">
            Suggested Alternatives ({alternatives.length})
          </h3>

          {alternatives.length === 0 ? (
            <p className="alt-empty">
              No alternatives found in the current dataset.
            </p>
          ) : (
            <>
              {visibleAlternatives.map((alt) => {
                const altPrice = getPrice?.(alt.model_id);
                const info = (
                  <div className="alt-item-info">
                    <div className="alt-item-name">{displayModelName(alt.name)}</div>
                    <div className="alt-item-meta">
                      <span className="alt-item-id">{alt.model_id}</span>
                      {altPrice !== undefined && altPrice > 0 && (
                        <span className="alt-item-price">{formatCost(altPrice)} /1M</span>
                      )}
                    </div>
                    <div className="alt-item-reason">{alt.reason}</div>
                  </div>
                );
                return (
                  <div key={alt.model_id} className="alt-item">
                    {onSelectAlternative ? (
                      <button
                        type="button"
                        className="alt-item-nav"
                        onClick={() => onSelectAlternative(alt.model_id)}
                        aria-label={`View details for ${displayModelName(alt.name)}`}
                      >
                        {info}
                      </button>
                    ) : (
                      info
                    )}
                    <CopyIDBtn id={alt.model_id} />
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="alt-show-more"
                  onClick={() => setShowAll(true)}
                >
                  Show {hiddenCount} more
                </button>
              )}
              {showAll && alternatives.length > INITIAL_VISIBLE && (
                <button
                  type="button"
                  className="alt-show-more"
                  onClick={() => setShowAll(false)}
                >
                  Show less
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

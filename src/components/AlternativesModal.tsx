import { useEffect, useState } from 'react';
import type { Model, Alternative } from '../schemas/api';
import { useModal } from '../hooks/useModal';
import { formatCost } from '../utils/format';
import { IconClose } from './icons';

interface AlternativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalModel: Model | null;
  alternatives: Alternative[];
  onSelectAlternative?: (modelId: string) => void;
  getPrice?: (modelId: string) => number | undefined;
}

const modalTitleId = 'alternatives-modal-title';
const INITIAL_VISIBLE = 3;

function CopyIDBtn({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const announce = (ok: boolean) => {
      setCopied(ok);
      if (ok) setTimeout(() => setCopied(false), 1500);
    };
    navigator.clipboard.writeText(id).then(
      () => announce(true),
      () => announce(fallbackCopy(id))
    );
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

function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function AlternativesModal({ isOpen, onClose, originalModel, alternatives, onSelectAlternative, getPrice }: AlternativesModalProps) {
  const modalRef = useModal(isOpen && !!originalModel, onClose);
  const [showAll, setShowAll] = useState(false);
  const visibleAlternatives = showAll ? alternatives : alternatives.slice(0, INITIAL_VISIBLE);
  const hiddenCount = alternatives.length - visibleAlternatives.length;

  useEffect(() => {
    setShowAll(false);
  }, [originalModel?.model_id]);

  if (!isOpen || !originalModel) return null;

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
            {originalModel.name}
          </h2>
          <div className="modal-model-id">
            <code>{originalModel.model_id}</code>
            <CopyIDBtn id={originalModel.model_id} />
          </div>
        </div>

        <div className="modal-stats">
          {originalModel.context_window && (
            <span className="badge-modality">
              {originalModel.context_window >= 1_000_000
                ? `${(originalModel.context_window / 1_000_000).toFixed(1)}M`
                : `${Math.floor(originalModel.context_window / 1000)}k`} ctx
            </span>
          )}
          {(originalModel.modality ?? []).map((m) => (
            <span key={m} className="badge-modality">{m.toUpperCase()}</span>
          ))}
          {(() => {
            const price = getPrice?.(originalModel.model_id);
            return price !== undefined && price > 0 ? (
              <span className="badge-modality badge-modality--price" title="Cost per 1M tokens">
                {formatCost(price)} /1M
              </span>
            ) : null;
          })()}
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
                    <div className="alt-item-name">{alt.name}</div>
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
                        aria-label={`View details for ${alt.name}`}
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
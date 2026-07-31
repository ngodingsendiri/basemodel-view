import { useEffect, useRef, useState } from 'react';
import type { Model, Alternative } from '../schemas/api';
import { sanitizeModelName, sanitizeModelId, sanitizeReason } from '../utils/sanitize';

interface AlternativesModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalModel: Model | null;
  alternatives: Alternative[];
}

const modalTitleId = 'alternatives-modal-title';

function CopyIDBtn({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
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
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy model ID'}
      title={copied ? 'Copied' : 'Copy model ID'}
      className="copy-btn"
    >
      {copied ? 'copied' : 'copy'}
    </button>
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

export function AlternativesModal({ isOpen, onClose, originalModel, alternatives }: AlternativesModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      modalRef.current?.focus();
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements?.length) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
          ✕
        </button>

        <div className="modal-header">
          <h2 id={modalTitleId} className="modal-title">
            {sanitizeModelName(originalModel.name)}
          </h2>
          <div className="modal-model-id">
            <code>{sanitizeModelId(originalModel.model_id)}</code>
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
            alternatives.map((alt) => (
              <div key={alt.model_id} className="alt-item">
                <div className="alt-item-info">
                  <div className="alt-item-name">{sanitizeModelName(alt.name)}</div>
                  <div className="alt-item-meta">
                    <span className="alt-item-id">{sanitizeModelId(alt.model_id)}</span>
                    <CopyIDBtn id={alt.model_id} />
                  </div>
                  <div className="alt-item-reason">{sanitizeReason(alt.reason)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
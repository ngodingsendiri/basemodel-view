import { useState } from 'react';
import type { Model } from '../types';
import { formatCtx, formatReleaseDate } from '../utils/format';
import { TIER_CLASS, MODALITY_LABEL } from './ui/constants';
import { IconStar } from './icons';
import { sanitizeModelName, sanitizeModelId, sanitizeProviderName } from '../utils/sanitize';

interface ModelCardProps {
  model: Model;
  tier: string;
  onClick: (modelId: string) => void;
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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        if (fallbackCopy(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }
    );
  };
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={copy}
      title={copied ? 'Copied' : `Copy ${label}`}
      aria-label={copied ? 'Copied' : `Copy ${label}`}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      )}
    </button>
  );
}

const MAX_VISIBLE_MODALITIES = 3;

export function ModelCard({ model, tier, onClick }: ModelCardProps) {
  const isFree = tier === 'Free';
  const releaseYear = formatReleaseDate(model.release_date);
  const modalities = model.modality ?? [];
  const visibleModalities = modalities.slice(0, MAX_VISIBLE_MODALITIES);
  const hiddenModalityCount = modalities.length - visibleModalities.length;

  const handleClick = () => onClick(model.model_id);

  return (
    <div className={`model-card ${isFree ? 'model-card--free' : ''}`}>
      <button
        type="button"
        className="model-card-hitarea"
        onClick={handleClick}
        aria-label={`View details for ${sanitizeModelName(model.name)}`}
      >
        {/* Top Line: name + tier badge */}
        <span className="card-topline">
          <span className="model-name" title={sanitizeModelName(model.name)}>{sanitizeModelName(model.name)}</span>
          <span className={`tier-badge ${TIER_CLASS[tier] ?? 'badge-tier-unknown'}`}>
            {isFree ? (
              <>
                <IconStar width={10} height={10} /> Free
              </>
            ) : (
              sanitizeProviderName(tier)
            )}
          </span>
        </span>

        {/* Id Line: model id */}
        <span className="card-idline">
          <span className="model-id" title={sanitizeModelId(model.model_id)}>{sanitizeModelId(model.model_id)}</span>
        </span>

        {/* Meta Line: stats + modality pills */}
        <span className="card-metaline">
          {model.context_window != null && (
            <span className="stat-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
              {formatCtx(model.context_window)} ctx
            </span>
          )}
          {model.max_output_tokens != null && (
            <span className="stat-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              {formatCtx(model.max_output_tokens)} out
            </span>
          )}
          {releaseYear && (
            <span className="stat-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              {releaseYear}
            </span>
          )}
          {visibleModalities.length > 0 && (
            <span className="modality-chips">
              {visibleModalities.map((m) => (
                <span key={m} className="modality-chip">{MODALITY_LABEL[m] ?? m.toUpperCase()}</span>
              ))}
              {hiddenModalityCount > 0 && (
                <span className="modality-chip modality-chip--more">+{hiddenModalityCount}</span>
              )}
            </span>
          )}
        </span>
      </button>

      <CopyButton text={model.model_id} label="model ID" />
    </div>
  );
}

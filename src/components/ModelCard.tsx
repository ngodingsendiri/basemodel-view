import { useState } from 'react';
import type { CanonicalModel, BenchmarkScore } from '../types';
import { formatCtx, formatReleaseDate, formatCost, displayModelName } from '../utils/format';
import { copyText } from '../utils/clipboard';
import { TIER_CLASS, MODALITY_LABEL, MAX_COMPARE, benchmarkLabel } from './ui/constants';
import { IconTag, IconCheck, IconCopy } from './icons';

interface ModelCardProps {
  model: CanonicalModel;
  tier: string;
  /** Cheapest known price per 1M tokens across providers. */
  price?: number;
  /** Number of providers serving this model. */
  providerCount?: number;
  /** Benchmark-derived quality score (0–100), when available. */
  qualityScore?: number;
  /** True when the model sits on the quality/cost Pareto frontier. */
  pareto?: boolean;
  /** Model gained an offering in the latest registry run. */
  isNew?: boolean;
  /** Score + rank on the active ranking benchmark (when sorting by rank). */
  rank?: BenchmarkScore;
  rankBenchmarkName?: string;
  compareSelected?: boolean;
  /** Disables adding new models when the comparison cap is reached. */
  compareDisabled?: boolean;
  onToggleCompare?: (modelId: string) => void;
  onClick: (modelId: string) => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    copyText(text).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    });
  };
  return (
    <>
      <button
        type="button"
        className="copy-btn"
        onClick={copy}
        title={copied ? 'Copied' : `Copy ${label}`}
        aria-label={copied ? 'Copied' : `Copy ${label}`}
      >
        {copied ? <IconCheck width={11} height={11} /> : <IconCopy width={11} height={11} />}
      </button>
      <span role="status" className="visually-hidden" aria-live="polite">
        {copied ? `Copied ${label}` : ''}
      </span>
    </>
  );
}

const MAX_VISIBLE_MODALITIES = 3;

export function ModelCard({
  model,
  tier,
  price,
  providerCount,
  qualityScore,
  pareto = false,
  isNew = false,
  rank,
  rankBenchmarkName,
  compareSelected,
  compareDisabled,
  onToggleCompare,
  onClick,
}: ModelCardProps) {
  const isFree = tier === 'Free';
  const releaseYear = formatReleaseDate(model.release_date);
  const modalities = model.modality ?? [];
  const visibleModalities = modalities.slice(0, MAX_VISIBLE_MODALITIES);
  const hiddenModalityCount = modalities.length - visibleModalities.length;
  const displayName = displayModelName(model.name);

  const handleClick = () => onClick(model.model_id);

  return (
    <div className={`model-card ${isFree ? 'model-card--free' : ''}`}>
      <button
        type="button"
        className="model-card-hitarea"
        onClick={handleClick}
        aria-label={`View details for ${displayName}`}
      >
        {/* Top Line: name + quality + rank + tier badge */}
        <span className="card-topline">
          <span className="model-name" title={displayName}>{displayName}</span>
          {isNew && <span className="new-chip" title="New in the latest registry update">New</span>}
          {qualityScore != null && (
            <span
              className={`quality-chip${pareto ? ' quality-chip--pareto' : ''}`}
              title={pareto
                ? `Quality ${qualityScore.toFixed(1)}/100 — Pareto optimal (best quality-to-cost frontier)`
                : `Quality ${qualityScore.toFixed(1)}/100 (benchmark average)`}
            >
              {pareto && '★ '}{qualityScore.toFixed(1)}
            </span>
          )}
          {rank && rankBenchmarkName && (
            <span
              className="rank-chip"
              title={`Ranked #${rank.rank} on ${benchmarkLabel(rankBenchmarkName)} (score ${rank.score})`}
            >
              #{rank.rank} · {rank.score}
            </span>
          )}
          <span className={`tier-badge ${TIER_CLASS[tier] ?? 'badge-tier-unknown'}`}>
            {isFree ? (
              <>
                <IconTag width={10} height={10} /> Free
              </>
            ) : (
              tier
            )}
          </span>
        </span>

        {/* Meta Line: stats + modality pills */}
        <span className="card-metaline">
          {providerCount != null && providerCount > 0 && (
            <span className="stat-chip" title={`Served by ${providerCount} provider${providerCount === 1 ? '' : 's'}`}>
              {providerCount} prov
            </span>
          )}
          {model.context_window != null && (
            <span className="stat-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
              {formatCtx(model.context_window)} ctx
            </span>
          )}
          {releaseYear && (
            <span className="stat-chip">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              {releaseYear}
            </span>
          )}
          {price !== undefined && price > 0 && (
            <span className="stat-chip stat-chip--price" title="Cheapest known cost per 1M tokens across providers">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              from {formatCost(price)} /1M
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

      {onToggleCompare && (
        <button
          type="button"
          className="compare-toggle"
          onClick={() => onToggleCompare(model.model_id)}
          disabled={compareDisabled && !compareSelected}
          aria-pressed={compareSelected ?? false}
          aria-label={
            compareSelected
              ? `Remove ${displayName} from comparison`
              : compareDisabled
                ? `Comparison limit reached (max ${MAX_COMPARE})`
                : `Add ${displayName} to comparison`
          }
          title={
            compareSelected
              ? 'Remove from comparison'
              : compareDisabled
                ? `Comparison limit reached (max ${MAX_COMPARE})`
                : 'Add to comparison'
          }
        >
          <IconCheck width={12} height={12} />
        </button>
      )}
    </div>
  );
}

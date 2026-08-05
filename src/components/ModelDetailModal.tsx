import { useEffect, useState } from 'react';
import type { CanonicalModel, Offering, Provider, RankingEntry } from '../schemas/api';
import type { ModelPricing } from '../hooks/useExplorerData';
import { useModal } from '../hooks/useModal';
import { formatCtx, formatReleaseDate, formatCost, displayModelName } from '../utils/format';
import { copyText } from '../utils/clipboard';
import { TIER_CLASS, benchmarkLabel } from './ui/constants';
import { PROVIDER_LINKS } from '../config/providers';
import { IconClose, IconExternal } from './icons';

interface ModelDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: CanonicalModel | null;
  /** All provider offerings serving this model. */
  offerings: Offering[];
  providers: Provider[];
  /** Resolved price/tier across offerings (cheapest known). */
  pricing?: ModelPricing;
  /** Pareto ranking entry when the model is benchmark-ranked. */
  ranking?: RankingEntry;
  isNew?: boolean;
  /** Benchmark scores/ranks available for the model. */
  benchmarks?: { name: string; score: number; rank: number }[];
}

const modalTitleId = 'model-detail-modal-title';

function CopyIDBtn({ id, label = 'Copy model ID' }: { id: string; label?: string }) {
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
        aria-label={copied ? 'Copied' : label}
        title={copied ? 'Copied' : label}
        className="copy-btn"
      >
        {copied ? 'copied' : 'copy'}
      </button>
      <span role="status" className="visually-hidden" aria-live="polite">
        {copied ? label : ''}
      </span>
    </>
  );
}

/** Offerings sort: priced ascending, then free, then unknown. */
function sortOfferings(offerings: Offering[]): Offering[] {
  return [...offerings].sort((a, b) => {
    const pa = a.blended_cost_per_1m;
    const pb = b.blended_cost_per_1m;
    const va = pa != null && pa > 0 ? pa : pa === 0 && a.cost_tier === 'Free' ? 0 : Number.POSITIVE_INFINITY;
    const vb = pb != null && pb > 0 ? pb : pb === 0 && b.cost_tier === 'Free' ? 0 : Number.POSITIVE_INFINITY;
    return va - vb;
  });
}

export function ModelDetailModal({
  isOpen,
  onClose,
  model,
  offerings,
  providers,
  pricing,
  ranking,
  isNew = false,
  benchmarks = [],
}: ModelDetailModalProps) {
  const modalRef = useModal(isOpen && !!model, onClose);
  const [highlightedOffering, setHighlightedOffering] = useState<string | null>(null);

  useEffect(() => {
    setHighlightedOffering(pricing?.offering_id ?? null);
  }, [model?.model_id, pricing?.offering_id]);

  if (!isOpen || !model) return null;

  const providerNames = new Map(providers.map((p) => [p.provider_id, p.name]));
  const sortedOfferings = sortOfferings(offerings);
  const context = model.context_window;
  const releaseDate = formatReleaseDate(model.release_date);
  const modalities = model.modality ?? [];
  const quality = model.quality;

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
            {displayModelName(model.name)}
            {isNew && <span className="new-chip">New</span>}
          </h2>
          <div className="modal-provider">
            <span className="modal-provider-name">
              {offerings.length} provider{offerings.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="modal-model-id">
            <code>{model.model_id}</code>
            <CopyIDBtn id={model.model_id} />
          </div>
          {model.aliases.length > 0 && (
            <div className="modal-aliases">
              {model.aliases.map((alias) => (
                <span key={alias} className="alias-chip" title="Also known as">{alias}</span>
              ))}
            </div>
          )}
        </div>

        {model.description && (
          <p className="modal-description">{model.description}</p>
        )}

        <div className="modal-specs">
          {quality && (
            <div className="spec-item">
              <span className="spec-label">Quality</span>
              <span
                className="spec-value"
                title={`Average of ${quality.benchmark_count} benchmark score(s)${quality.categories.length > 0 ? ` (${quality.categories.join(', ')})` : ''}`}
              >
                {quality.score.toFixed(1)} / 100
                {ranking?.pareto_optimal && <span className="pareto-star">★ Pareto</span>}
              </span>
            </div>
          )}
          {pricing && (
            <div className="spec-item">
              <span className="spec-label">Tier</span>
              <span className={`tier-badge ${TIER_CLASS[pricing.tier] ?? 'badge-tier-unknown'}`}>
                {pricing.tier}
              </span>
            </div>
          )}
          <div className="spec-item">
            <span className="spec-label">Price /1M</span>
            <span className="spec-value">
              {pricing?.price === undefined
                ? '—'
                : pricing.price === 0
                  ? 'Free'
                  : `from ${formatCost(pricing.price)} /1M`}
            </span>
          </div>
          {context != null && (
            <div className="spec-item">
              <span className="spec-label">Context</span>
              <span className="spec-value">up to {formatCtx(context)} tokens</span>
            </div>
          )}
          {releaseDate && (
            <div className="spec-item">
              <span className="spec-label">Released</span>
              <span className="spec-value">{releaseDate}</span>
            </div>
          )}
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
            Available Providers ({offerings.length})
          </h3>

          {offerings.length === 0 ? (
            <p className="alt-empty">
              No offerings found in the current dataset.
            </p>
          ) : (
            sortedOfferings.map((offering) => {
              const name = providerNames.get(offering.provider_id) ?? offering.provider_id;
              const link = PROVIDER_LINKS.get(offering.provider_id);
              const price = offering.blended_cost_per_1m;
              const tier = offering.cost_tier ?? 'Unknown';
              const isHighlighted = highlightedOffering === offering.offering_id;
              return (
                <div
                  key={offering.offering_id}
                  className={`alt-item${isHighlighted ? ' alt-item--best' : ''}`}
                >
                  <div className="alt-item-info">
                    <div className="alt-item-name">
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="modal-provider-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {name}
                          <IconExternal width={10} height={10} />
                        </a>
                      ) : (
                        name
                      )}
                      {isHighlighted && <span className="best-offer-chip">Best price</span>}
                    </div>
                    <div className="alt-item-meta">
                      <span className="alt-item-id">{offering.offering_id}</span>
                      {offering.context_window != null && (
                        <span className="alt-item-ctx">{formatCtx(offering.context_window)} ctx</span>
                      )}
                      <span className={`tier-badge ${TIER_CLASS[tier] ?? 'badge-tier-unknown'}`}>
                        {tier}
                      </span>
                    </div>
                  </div>
                  <div className="alt-item-price-col">
                    {price === undefined
                      ? <span className="alt-item-price">—</span>
                      : price === 0
                        ? <span className="alt-item-price alt-item-price--free">Free</span>
                        : <span className="alt-item-price">{formatCost(price)} /1M</span>}
                    <CopyIDBtn id={offering.offering_id} label="Copy offering ID" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

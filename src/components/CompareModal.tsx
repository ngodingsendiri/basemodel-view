import type { CanonicalModel, BenchmarkScore } from '../schemas/api';
import { useModal } from '../hooks/useModal';
import { formatCtx, formatReleaseDate, formatCost, displayModelName } from '../utils/format';
import { MODALITY_LABEL, benchmarkLabel } from './ui/constants';
import { IconClose } from './icons';

const compareTitleId = 'compare-modal-title';

interface CompareModalProps {
  models: CanonicalModel[];
  /** Display names of the providers serving each model. */
  getProviderNames?: (modelId: string) => string[];
  getTier: (modelId: string) => string;
  getPrice?: (modelId: string) => number | undefined;
  getBenchmarkScore?: (modelId: string, name: string) => BenchmarkScore | undefined;
  benchmarkNames?: string[];
  onClose: () => void;
  onRemove: (modelId: string) => void;
}

export function CompareModal({
  models,
  getProviderNames,
  getTier,
  getPrice,
  getBenchmarkScore,
  benchmarkNames = [],
  onClose,
  onRemove,
}: CompareModalProps) {
  const dialogRef = useModal(true, onClose);

  if (models.length === 0) return null;

  type CompareRow = {
    label: string;
    render: (m: CanonicalModel) => React.ReactNode;
    best?: (m: CanonicalModel) => number | null;
    bestMode?: 'min' | 'max';
  };

  const rows: CompareRow[] = [
    {
      label: 'Providers',
      render: (m) => {
        const names = getProviderNames?.(m.model_id) ?? [];
        return names.length > 0 ? names.join(', ') : '—';
      },
    },
    {
      label: 'Tier',
      render: (m) => getTier(m.model_id),
    },
    {
      label: 'Price /1M',
      render: (m) => {
        const price = getPrice?.(m.model_id);
        if (price == null) return '—';
        return price === 0 ? 'Free' : `${formatCost(price)} /1M`;
      },
      best: (m) => getPrice?.(m.model_id) ?? null,
      bestMode: 'min',
    },
    {
      label: 'Quality',
      render: (m) => (m.quality ? `${m.quality.score.toFixed(1)} / 100` : '—'),
      best: (m) => m.quality?.score ?? null,
      bestMode: 'max',
    },
    {
      label: 'Context',
      render: (m) => (m.context_window != null ? `${formatCtx(m.context_window)} tokens` : '—'),
      best: (m) => m.context_window ?? null,
      bestMode: 'max',
    },
    {
      label: 'Modalities',
      render: (m) =>
        (m.modality ?? []).length > 0
          ? (m.modality ?? []).map((mod) => MODALITY_LABEL[mod] ?? mod.toUpperCase()).join(', ')
          : '—',
    },
    {
      label: 'Released',
      render: (m) => formatReleaseDate(m.release_date) ?? '—',
    },
    {
      label: 'Description',
      render: (m) => m.description ?? '—',
    },
    ...benchmarkNames.map((name) => ({
      label: benchmarkLabel(name),
      render: (m: CanonicalModel) => {
        const score = getBenchmarkScore?.(m.model_id, name);
        return score ? `${score.score} (#${score.rank})` : '—';
      },
      best: (m: CanonicalModel) => getBenchmarkScore?.(m.model_id, name)?.score ?? null,
      bestMode: 'max' as const,
    })),
  ];

  const bestValueFor = (row: CompareRow): number | null => {
    if (!row.best) return null;
    const mode = row.bestMode ?? 'max';
    const values = models.map((m) => row.best!(m)).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return mode === 'min' ? Math.min(...values) : Math.max(...values);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal-content compare-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={compareTitleId}
        tabIndex={-1}
      >
        <button type="button" className="close-button" onClick={onClose} aria-label="Close comparison">
          <IconClose width={14} height={14} />
        </button>

        <div className="modal-header">
          <h2 id={compareTitleId} className="modal-title">
            Compare models
          </h2>
        </div>

        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-table-label" scope="col">Attribute</th>
                {models.map((m) => (
                  <th key={m.model_id} scope="col">
                    <div className="compare-th">
                      <div className="compare-th-name">{displayModelName(m.name)}</div>
                      <div className="compare-th-id">{m.model_id}</div>
                      <button
                        type="button"
                        className="compare-th-remove"
                        onClick={() => onRemove(m.model_id)}
                        aria-label={`Remove ${displayModelName(m.name)} from comparison`}
                      >
                        <IconClose width={11} height={11} /> Remove
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const bestValue = bestValueFor(row);
                return (
                  <tr key={row.label}>
                    <th className="compare-table-label" scope="row">{row.label}</th>
                    {models.map((m) => {
                      const value = row.best?.(m);
                      const isBest = bestValue != null && value != null && value === bestValue;
                      return (
                        <td key={m.model_id} className={isBest ? 'compare-best' : undefined}>
                          {row.render(m)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

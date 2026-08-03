export function formatCtx(ctx: number): string {
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${Math.floor(ctx / 1_000)}k`;
  return ctx.toString();
}

export function formatReleaseDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

export function formatCost(n: number | undefined): string {
  if (n === undefined) return '—';
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
  return `$${formatted}`;
}
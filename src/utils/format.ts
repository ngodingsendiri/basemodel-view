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

/**
 * Human-friendly model name for card/list display. Strips the leading "~" and
 * any provider/namespace prefix so "anthropic/claude-3-5-haiku" renders as
 * "claude-3-5-haiku". Falls back to the raw name when nothing remains. The
 * full raw id stays available via the copy button, tooltip, and detail modal.
 */
export function displayModelName(name: string): string {
  const cleaned = name.startsWith('~') ? name.slice(1) : name;
  const lastSlash = cleaned.lastIndexOf('/');
  if (lastSlash !== -1) {
    const rest = cleaned.slice(lastSlash + 1);
    if (rest) return rest;
  }
  return cleaned || name;
}
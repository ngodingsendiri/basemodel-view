/** Maximum number of models that can be compared side by side. */
export const MAX_COMPARE = 6;

export const TIER_CLASS: Record<string, string> = {
  Free: 'badge-tier-free',
  'Budget-Friendly': 'badge-tier-budget',
  Balanced: 'badge-tier-balanced',
  Premium: 'badge-tier-premium',
};

export const MODALITY_LABEL: Record<string, string> = {
  text: 'TXT',
  code: 'CODE',
  image: 'IMG',
  audio: 'AUD',
  video: 'VID',
  embedding: 'EMB',
};

export const BENCHMARK_LABEL: Record<string, string> = {
  code: 'Code',
  text: 'Text',
  average: 'Overall',
  bbh: 'BBH Reasoning',
  gpqa: 'GPQA Reasoning',
  musr: 'MUSR Reasoning',
  'math-lvl-5': 'Math',
  ifeval: 'Instruction Following',
  'mmlu-pro': 'MMLU-Pro',
};

/** Human label for a benchmark/ranking name (fallback: Title Case). */
export function benchmarkLabel(name: string): string {
  return (
    BENCHMARK_LABEL[name] ??
    name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

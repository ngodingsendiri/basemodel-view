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

import { providerId, type ProviderId } from '../domain/branded';

/**
 * Per-provider dashboard/API-key URLs. Kept separate from the data schema so
 * adding a provider link never requires touching the validation layer.
 * Only providers present in dist/providers.json are listed.
 */
export const PROVIDER_LINKS: ReadonlyMap<ProviderId, string> = new Map([
  [providerId('openai'), 'https://platform.openai.com/'],
  [providerId('anthropic'), 'https://console.anthropic.com/'],
  [providerId('google'), 'https://aistudio.google.com/'],
  [providerId('openrouter'), 'https://openrouter.ai/settings/keys'],
  [providerId('groq'), 'https://console.groq.com/keys'],
  [providerId('deepinfra'), 'https://deepinfra.com/dash/api_keys'],
  [providerId('cerebras'), 'https://cloud.cerebras.ai/'],
  [providerId('hyperbolic'), 'https://app.hyperbolic.xyz/settings'],
  [providerId('requesty'), 'https://requesty.ai/'],
  [providerId('vercel'), 'https://sdk.vercel.ai/'],
  [providerId('meta'), 'https://llama.meta.com/'],
  [providerId('mistral-ai'), 'https://console.mistral.ai/'],
]);

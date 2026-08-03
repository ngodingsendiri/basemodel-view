import { providerId, type ProviderId } from '../domain/branded';

/**
 * Per-provider dashboard/API-key URLs. Kept separate from the data schema so
 * adding a provider link never requires touching the validation layer.
 */
export const PROVIDER_LINKS: ReadonlyMap<ProviderId, string> = new Map([
  [providerId('openai'), 'https://platform.openai.com/'],
  [providerId('anthropic'), 'https://console.anthropic.com/'],
  [providerId('google'), 'https://aistudio.google.com/'],
  [providerId('openrouter'), 'https://openrouter.ai/settings/keys'],
  [providerId('groq'), 'https://console.groq.com/keys'],
  [providerId('together'), 'https://api.together.xyz/settings/api-keys'],
  [providerId('deepinfra'), 'https://deepinfra.com/dash/api_keys'],
  [providerId('fireworks'), 'https://fireworks.ai/api-keys'],
  [providerId('cerebras'), 'https://cloud.cerebras.ai/'],
  [providerId('hyperbolic'), 'https://app.hyperbolic.xyz/settings'],
  [providerId('litellm'), 'https://litellm.ai/'],
  [providerId('portkey'), 'https://app.portkey.ai/'],
  [providerId('helicone'), 'https://www.helicone.ai/'],
  [providerId('cloudflare'), 'https://dash.cloudflare.com/?to=/:account/ai/workers-ai'],
  [providerId('requesty'), 'https://requesty.ai/'],
  [providerId('datalab'), 'https://datalab.to/'],
  [providerId('bifrost'), 'https://getbifrost.com/'],
  [providerId('vercel'), 'https://sdk.vercel.ai/'],
  [providerId('meta'), 'https://llama.meta.com/'],
  [providerId('mistral-ai'), 'https://console.mistral.ai/'],
]);

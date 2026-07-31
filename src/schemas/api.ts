import { z } from 'zod';
import { modelId, providerId, type ProviderId } from '../domain/branded';

const ModelIdSchema = z.string().min(1).transform(modelId);
const ProviderIdSchema = z.string().min(1).transform(providerId);

export const ModelSchema = z.object({
  model_id: ModelIdSchema,
  name: z.string().min(1),
  provider_id: ProviderIdSchema,
  context_window: z.number().int().positive().optional(),
  max_output_tokens: z.number().int().positive().optional(),
  release_date: z.union([z.iso.date(), z.iso.datetime()]).optional(),
  modality: z.array(z.string()).default([]),
  description: z.string().optional(),
});

export const ProviderSchema = z.object({
  provider_id: ProviderIdSchema,
  name: z.string().min(1),
});

export const AlternativeSchema = z.object({
  model_id: ModelIdSchema,
  name: z.string().min(1),
  reason: z.string(),
});

export const IntelligenceRecordSchema = z.object({
  model_id: ModelIdSchema,
  cost_tier: z.string(),
  blended_cost_per_1m: z.number(),
  alternatives: z.array(AlternativeSchema),
}).refine(
  (record) => !record.alternatives.some((a) => a.model_id === record.model_id),
  { message: 'Alternatives must not reference the same model as the record' }
);

export const ModelsResponseSchema = z.object({
  models: z.array(ModelSchema),
});

export const ProvidersResponseSchema = z.object({
  providers: z.array(ProviderSchema),
});

export const IntelligenceResponseSchema = z.object({
  intelligence: z.array(IntelligenceRecordSchema),
});

export type Model = z.infer<typeof ModelSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Alternative = z.infer<typeof AlternativeSchema>;
export type IntelligenceRecord = z.infer<typeof IntelligenceRecordSchema>;

export interface ExplorerData {
  models: Model[];
  providers: Provider[];
}

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
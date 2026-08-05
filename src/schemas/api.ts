import { z } from 'zod';
import { modelId, providerId } from '../domain/branded';

const ModelIdSchema = z.string().min(1).transform(modelId);
const ProviderIdSchema = z.string().min(1).transform(providerId);

export const ProviderSchema = z.object({
  provider_id: ProviderIdSchema,
  name: z.string().min(1),
});

/** Benchmark-derived quality attached to a canonical model (dist/v2/models.json). */
export const QualitySchema = z.object({
  score: z.number().min(0).max(100),
  benchmark_count: z.number().int().nonnegative().default(0),
  categories: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
});

/**
 * Canonical physical model (dist/v2/models.json). `model_id` is a
 * provider-less slug (e.g. "gpt-4o"); every provider serve is an Offering.
 */
export const CanonicalModelSchema = z.object({
  model_id: ModelIdSchema,
  name: z.string().min(1),
  family: z.string().optional(),
  description: z.string().optional(),
  release_date: z.string().optional(),
  modality: z.array(z.string()).default([]),
  open_weight: z.boolean().default(false),
  reasoning_support: z.boolean().default(false),
  function_calling: z.boolean().default(false),
  structured_output: z.boolean().default(false),
  vision_support: z.boolean().default(false),
  audio_support: z.boolean().default(false),
  image_generation: z.boolean().default(false),
  embedding_support: z.boolean().default(false),
  context_window: z.number().int().positive().optional(),
  capability_ids: z.array(z.string()).default([]),
  license_id: z.string().optional(),
  status: z.enum(['active', 'preview', 'deprecated', 'discontinued']).default('active'),
  aliases: z.array(z.string()).default([]),
  offering_ids: z.array(z.string()).default([]),
  quality: QualitySchema.optional(),
});

/** A provider's serve of a canonical model (dist/v2/offerings.json). */
export const OfferingSchema = z.object({
  offering_id: z.string().min(1),
  model_id: ModelIdSchema,
  provider_id: ProviderIdSchema,
  status: z.enum(['active', 'preview', 'deprecated', 'discontinued']).default('active'),
  context_window: z.number().int().positive().optional(),
  cost_tier: z.enum(['Free', 'Budget-Friendly', 'Balanced', 'Premium', 'Unknown']).optional(),
  blended_cost_per_1m: z.number().nonnegative().optional(),
  is_cheapest: z.boolean().optional(),
});

/** Pareto ranking entry (dist/v2/intelligence.json). */
export const RankingEntrySchema = z.object({
  model_id: ModelIdSchema,
  quality_score: z.number().min(0).max(100),
  benchmark_count: z.number().int().nonnegative().default(0),
  categories: z.array(z.string()).default([]),
  cheapest_offering: z.string().optional(),
  cheapest_provider: z.string().optional(),
  blended_cost_per_1m: z.number().nonnegative().optional(),
  pareto_optimal: z.boolean().default(false),
});

/** Registry delta feed (dist/changes.json); ids are offering ids. */
export const ChangesFeedSchema = z.object({
  generated_at: z.string().optional(),
  added: z.array(z.string()).default([]),
  removed: z.array(z.string()).default([]),
  status_changed: z.array(z.string()).default([]),
});

export const BenchmarkSchema = z.object({
  benchmark_id: z.string().min(1),
  /** Catalog or leaderboard model id; matched against catalog ids by last path segment. */
  model_id: z.string().min(1),
  benchmark_name: z.string().min(1),
  version: z.string().optional(),
  score: z.number().min(0).max(100),
  score_raw: z.union([z.string(), z.number()]).optional(),
  evaluation_date: z.string().optional(),
  source: z.enum(['lmarena', 'openllm', 'mirror']),
  category: z.array(z.string()).default([]),
  rank: z.number().optional(),
});

export const CanonicalModelsResponseSchema = z.object({
  models: z.array(CanonicalModelSchema),
});

export const ProvidersResponseSchema = z.object({
  providers: z.array(ProviderSchema),
});

export const OfferingsResponseSchema = z.object({
  offerings: z.array(OfferingSchema),
});

export const RankingResponseSchema = z.object({
  ranking: z.array(RankingEntrySchema),
});

export const BenchmarksResponseSchema = z.object({
  benchmarks: z.array(BenchmarkSchema),
});

export type Provider = z.infer<typeof ProviderSchema>;
export type Quality = z.infer<typeof QualitySchema>;
export type CanonicalModel = z.infer<typeof CanonicalModelSchema>;
export type Offering = z.infer<typeof OfferingSchema>;
export type RankingEntry = z.infer<typeof RankingEntrySchema>;
export type ChangesFeed = z.infer<typeof ChangesFeedSchema>;
export type Benchmark = z.infer<typeof BenchmarkSchema>;

/** Client-side derived score + rank for one model on one benchmark. */
export interface BenchmarkScore {
  score: number;
  rank: number;
}

export interface ExplorerData {
  models: CanonicalModel[];
  providers: Provider[];
  offerings: Offering[];
}

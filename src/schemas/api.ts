import { z } from 'zod';
import { modelId, providerId } from '../domain/branded';

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

export const BenchmarksResponseSchema = z.object({
  benchmarks: z.array(BenchmarkSchema),
});

export const IntelligenceResponseSchema = z.object({
  intelligence: z.array(IntelligenceRecordSchema),
});

export type Model = z.infer<typeof ModelSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Alternative = z.infer<typeof AlternativeSchema>;
export type IntelligenceRecord = z.infer<typeof IntelligenceRecordSchema>;
export type Benchmark = z.infer<typeof BenchmarkSchema>;

/** Client-side derived score + rank for one model on one benchmark. */
export interface BenchmarkScore {
  score: number;
  rank: number;
}

export interface ExplorerData {
  models: Model[];
  providers: Provider[];
}
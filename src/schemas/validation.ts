import { z } from 'zod';
import {
  ModelsResponseSchema,
  ProvidersResponseSchema,
  IntelligenceResponseSchema,
  type Model,
  type Provider,
  type IntelligenceRecord,
} from '../types';

export function validateModelsResponse(data: unknown): { models: Model[] } {
  return ModelsResponseSchema.parse(data);
}

export function validateProvidersResponse(data: unknown): { providers: Provider[] } {
  return ProvidersResponseSchema.parse(data);
}

export function validateIntelligenceResponse(data: unknown): { intelligence: IntelligenceRecord[] } {
  return IntelligenceResponseSchema.parse(data);
}

export function safeParseModelsResponse(data: unknown): { success: true; data: { models: Model[] } } | { success: false; error: z.ZodError } {
  const result = ModelsResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function safeParseProvidersResponse(data: unknown): { success: true; data: { providers: Provider[] } } | { success: false; error: z.ZodError } {
  const result = ProvidersResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function safeParseIntelligenceResponse(data: unknown): { success: true; data: { intelligence: IntelligenceRecord[] } } | { success: false; error: z.ZodError } {
  const result = IntelligenceResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
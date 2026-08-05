import { z } from 'zod';
import {
  CanonicalModelsResponseSchema,
  ProvidersResponseSchema,
  OfferingsResponseSchema,
  type CanonicalModel,
  type Provider,
  type Offering,
} from '../types';

export function validateModelsResponse(data: unknown): { models: CanonicalModel[] } {
  return CanonicalModelsResponseSchema.parse(data);
}

export function validateProvidersResponse(data: unknown): { providers: Provider[] } {
  return ProvidersResponseSchema.parse(data);
}

export function validateOfferingsResponse(data: unknown): { offerings: Offering[] } {
  return OfferingsResponseSchema.parse(data);
}

export function safeParseModelsResponse(data: unknown): { success: true; data: { models: CanonicalModel[] } } | { success: false; error: z.ZodError } {
  const result = CanonicalModelsResponseSchema.safeParse(data);
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

export function safeParseOfferingsResponse(data: unknown): { success: true; data: { offerings: Offering[] } } | { success: false; error: z.ZodError } {
  const result = OfferingsResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

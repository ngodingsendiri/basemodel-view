import { modelId, providerId } from '../domain/branded';
import type { CanonicalModel, Offering } from '../schemas/api';

/** Builds a fully-defaulted CanonicalModel fixture for unit tests. */
export function makeModel(id: string, overrides: Partial<CanonicalModel> = {}): CanonicalModel {
  return {
    model_id: modelId(id),
    name: id,
    modality: [],
    open_weight: false,
    reasoning_support: false,
    function_calling: false,
    structured_output: false,
    vision_support: false,
    audio_support: false,
    image_generation: false,
    embedding_support: false,
    capability_ids: [],
    status: 'active',
    aliases: [],
    offering_ids: [],
    ...overrides,
  };
}

/** Builds a fully-defaulted Offering fixture for unit tests. */
export function makeOffering(
  offeringId: string,
  model: string,
  provider: string,
  overrides: Partial<Offering> = {}
): Offering {
  return {
    offering_id: offeringId,
    model_id: modelId(model),
    provider_id: providerId(provider),
    status: 'active',
    ...overrides,
  };
}

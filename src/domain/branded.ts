export type ModelId = string & { readonly __brand: unique symbol };
export type ProviderId = string & { readonly __brand: unique symbol };

export function modelId(s: string): ModelId {
  return s as ModelId;
}

export function providerId(s: string): ProviderId {
  return s as ProviderId;
}

export function assertModelId(value: unknown): asserts value is ModelId {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid ModelId');
  }
}

export function assertProviderId(value: unknown): asserts value is ProviderId {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid ProviderId');
  }
}
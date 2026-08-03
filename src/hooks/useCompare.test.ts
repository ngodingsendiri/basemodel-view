import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompare } from './useCompare';
import { MAX_COMPARE } from '../components/ui/constants';
import { modelId, providerId } from '../domain/branded';
import type { Model } from '../schemas/api';

const mockModels: Model[] = [
  { model_id: modelId('a/model1'), name: 'Alpha Model', provider_id: providerId('a'), modality: ['text'] },
  { model_id: modelId('b/model2'), name: 'Beta Model', provider_id: providerId('b'), modality: ['text'] },
  { model_id: modelId('a/model3'), name: 'Gamma Model', provider_id: providerId('a'), modality: ['text'] },
];

describe('useCompare', () => {
  it('toggles models in and out of the selection', () => {
    const { result } = renderHook(() => useCompare(mockModels));

    act(() => result.current.toggle('a/model1'));
    expect(result.current.selected.has(modelId('a/model1'))).toBe(true);
    expect(result.current.selectedModels).toHaveLength(1);

    act(() => result.current.toggle('b/model2'));
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['a/model1', 'b/model2']);

    act(() => result.current.toggle('a/model1'));
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['b/model2']);
  });

  it('caps the selection at MAX_COMPARE and reports isFull', () => {
    const many: Model[] = Array.from({ length: MAX_COMPARE + 3 }, (_, i) => ({
      model_id: modelId(`p/m${i}`),
      name: `Model ${i}`,
      provider_id: providerId('p'),
      modality: ['text'],
    }));
    const { result } = renderHook(() => useCompare(many));

    for (let i = 0; i < MAX_COMPARE; i++) {
      act(() => result.current.toggle(`p/m${i}`));
    }
    expect(result.current.selected.size).toBe(MAX_COMPARE);
    expect(result.current.isFull).toBe(true);

    // Adding beyond the cap is ignored...
    act(() => result.current.toggle(`p/m${MAX_COMPARE}`));
    expect(result.current.selected.size).toBe(MAX_COMPARE);

    // ...but removing still works, and then the slot frees up.
    act(() => result.current.toggle(`p/m0`));
    expect(result.current.selected.size).toBe(MAX_COMPARE - 1);
    expect(result.current.isFull).toBe(false);
    act(() => result.current.toggle(`p/m${MAX_COMPARE}`));
    expect(result.current.selected.size).toBe(MAX_COMPARE);
  });

  it('truncates an oversized URL seed to MAX_COMPARE', () => {
    const many: Model[] = Array.from({ length: MAX_COMPARE + 3 }, (_, i) => ({
      model_id: modelId(`p/m${i}`),
      name: `Model ${i}`,
      provider_id: providerId('p'),
      modality: ['text'],
    }));
    const seed = many.map((m) => m.model_id);
    const { result } = renderHook(() => useCompare(many, seed));
    expect(result.current.selected.size).toBe(MAX_COMPARE);
  });

  it('clears the whole selection', () => {
    const { result } = renderHook(() => useCompare(mockModels));

    act(() => result.current.toggle('a/model1'));
    act(() => result.current.toggle('b/model2'));
    act(() => result.current.clear());

    expect(result.current.selected.size).toBe(0);
    expect(result.current.selectedModels).toHaveLength(0);
  });

  it('drops stale selections not present in the dataset', () => {
    const { result, rerender } = renderHook(({ models }) => useCompare(models), {
      initialProps: { models: mockModels },
    });

    act(() => result.current.toggle('a/model1'));
    act(() => result.current.toggle('b/model2'));

    const pruned = [mockModels[0]];
    rerender({ models: pruned });
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['a/model1']);
  });

  it('seeds the selection from the URL seed once data is available', () => {
    const { result } = renderHook(() =>
      useCompare(mockModels, [modelId('a/model1'), modelId('a/model3')])
    );

    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['a/model1', 'a/model3']);
  });

  it('drops URL seed ids that do not exist in the dataset', () => {
    const { result } = renderHook(() =>
      useCompare(mockModels, [modelId('a/model1'), modelId('missing/model9')])
    );

    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['a/model1']);
  });

  it('applies the URL seed once models arrive late', () => {
    const { result, rerender } = renderHook(({ models }) => useCompare(models, [modelId('b/model2')]), {
      initialProps: { models: [] as Model[] },
    });

    expect(result.current.selected.size).toBe(0);

    rerender({ models: mockModels });
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['b/model2']);
  });

  it('prunes the selection state (not just the projection) when the dataset shrinks', () => {
    const { result, rerender } = renderHook(({ models }) => useCompare(models), {
      initialProps: { models: mockModels },
    });

    act(() => result.current.toggle('a/model1'));
    act(() => result.current.toggle('b/model2'));

    rerender({ models: [mockModels[0]] });
    expect(result.current.selected.has(modelId('b/model2'))).toBe(false);
    expect(result.current.selected.has(modelId('a/model1'))).toBe(true);
  });
});

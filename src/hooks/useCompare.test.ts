import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompare } from './useCompare';
import { MAX_COMPARE } from '../components/ui/constants';
import { modelId } from '../domain/branded';
import type { CanonicalModel } from '../schemas/api';
import { makeModel } from '../test/fixtures';

const mockModels: CanonicalModel[] = [
  makeModel('model1', { name: 'Alpha Model' }),
  makeModel('model2', { name: 'Beta Model' }),
  makeModel('model3', { name: 'Gamma Model' }),
];

describe('useCompare', () => {
  it('toggles models in and out of the selection', () => {
    const { result } = renderHook(() => useCompare(mockModels));

    act(() => result.current.toggle('model1'));
    expect(result.current.selected.has(modelId('model1'))).toBe(true);
    expect(result.current.selectedModels).toHaveLength(1);

    act(() => result.current.toggle('model2'));
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['model1', 'model2']);

    act(() => result.current.toggle('model1'));
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['model2']);
  });

  it('caps the selection at MAX_COMPARE and reports isFull', () => {
    const many: CanonicalModel[] = Array.from({ length: MAX_COMPARE + 3 }, (_, i) =>
      makeModel(`m${i}`, { name: `Model ${i}` })
    );
    const { result } = renderHook(() => useCompare(many));

    for (let i = 0; i < MAX_COMPARE; i++) {
      act(() => result.current.toggle(`m${i}`));
    }
    expect(result.current.selected.size).toBe(MAX_COMPARE);
    expect(result.current.isFull).toBe(true);

    // Adding beyond the cap is ignored...
    act(() => result.current.toggle(`m${MAX_COMPARE}`));
    expect(result.current.selected.size).toBe(MAX_COMPARE);

    // ...but removing still works, and then the slot frees up.
    act(() => result.current.toggle(`m0`));
    expect(result.current.selected.size).toBe(MAX_COMPARE - 1);
    expect(result.current.isFull).toBe(false);
    act(() => result.current.toggle(`m${MAX_COMPARE}`));
    expect(result.current.selected.size).toBe(MAX_COMPARE);
  });

  it('truncates an oversized URL seed to MAX_COMPARE', () => {
    const many: CanonicalModel[] = Array.from({ length: MAX_COMPARE + 3 }, (_, i) =>
      makeModel(`m${i}`, { name: `Model ${i}` })
    );
    const seed = many.map((m) => m.model_id);
    const { result } = renderHook(() => useCompare(many, seed));
    expect(result.current.selected.size).toBe(MAX_COMPARE);
  });

  it('clears the whole selection', () => {
    const { result } = renderHook(() => useCompare(mockModels));

    act(() => result.current.toggle('model1'));
    act(() => result.current.toggle('model2'));
    act(() => result.current.clear());

    expect(result.current.selected.size).toBe(0);
    expect(result.current.selectedModels).toHaveLength(0);
  });

  it('drops stale selections not present in the dataset', () => {
    const { result, rerender } = renderHook(({ models }) => useCompare(models), {
      initialProps: { models: mockModels },
    });

    act(() => result.current.toggle('model1'));
    act(() => result.current.toggle('model2'));

    const pruned = [mockModels[0]];
    rerender({ models: pruned });
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['model1']);
  });

  it('seeds the selection from the URL seed once data is available', () => {
    const { result } = renderHook(() =>
      useCompare(mockModels, [modelId('model1'), modelId('model3')])
    );

    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['model1', 'model3']);
  });

  it('drops URL seed ids that do not exist in the dataset', () => {
    const { result } = renderHook(() =>
      useCompare(mockModels, [modelId('model1'), modelId('missing-model')])
    );

    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['model1']);
  });

  it('applies the URL seed once models arrive late', () => {
    const { result, rerender } = renderHook(({ models }) => useCompare(models, [modelId('model2')]), {
      initialProps: { models: [] as CanonicalModel[] },
    });

    expect(result.current.selected.size).toBe(0);

    rerender({ models: mockModels });
    expect(result.current.selectedModels.map((m) => m.model_id)).toEqual(['model2']);
  });

  it('prunes the selection state (not just the projection) when the dataset shrinks', () => {
    const { result, rerender } = renderHook(({ models }) => useCompare(models), {
      initialProps: { models: mockModels },
    });

    act(() => result.current.toggle('model1'));
    act(() => result.current.toggle('model2'));

    rerender({ models: [mockModels[0]] });
    expect(result.current.selected.has(modelId('model2'))).toBe(false);
    expect(result.current.selected.has(modelId('model1'))).toBe(true);
  });
});

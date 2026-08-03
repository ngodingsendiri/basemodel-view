import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, type ThemeMode } from './useTheme';

function installMedia(initialLight: boolean) {
  const state = { matchesLight: initialLight };
  const listeners: Array<() => void> = [];
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return state.matchesLight;
    },
    media: '(prefers-color-scheme: light)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
    dispatchEvent: vi.fn(),
  }));
  return {
    setLight(v: boolean) {
      state.matchesLight = v;
    },
    emit() {
      listeners.forEach((cb) => cb());
    },
  };
}

describe('useTheme', () => {
  it('defaults to system mode and follows the OS preference', () => {
    installMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
    expect(result.current.effectiveTheme).toBe('dark');
  });

  it('uses the OS light preference for the effective theme in system mode', () => {
    installMedia(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.effectiveTheme).toBe('light');
  });

  it('cycles system -> light -> dark -> system', () => {
    installMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.cycle());
    expect(result.current.mode).toBe('light');
    expect(result.current.effectiveTheme).toBe('light');
    act(() => result.current.cycle());
    expect(result.current.mode).toBe('dark');
    expect(result.current.effectiveTheme).toBe('dark');
    act(() => result.current.cycle());
    expect(result.current.mode).toBe('system');
    expect(result.current.effectiveTheme).toBe('dark');
  });

  it('reflects the mode on <html> data-theme and persists to localStorage', () => {
    installMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

    act(() => result.current.cycle());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('bm-theme')).toBe('light');

    act(() => result.current.cycle());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('bm-theme')).toBe('dark');

    act(() => result.current.cycle());
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('bm-theme')).toBe('system');
  });

  it('rehydrates from a stored preference', () => {
    installMedia(false);
    localStorage.setItem('bm-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('rejects an unknown stored value and falls back to system', () => {
    installMedia(false);
    localStorage.setItem('bm-theme', 'sepia' as ThemeMode);
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
  });

  it('tracks OS preference changes while in system mode', () => {
    const media = installMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.effectiveTheme).toBe('dark');

    media.setLight(true);
    act(() => media.emit());
    expect(result.current.effectiveTheme).toBe('light');
  });
});

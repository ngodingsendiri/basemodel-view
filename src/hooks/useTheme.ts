import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

function getStoredMode(): ThemeMode {
  const stored = localStorage.getItem('bm-theme');
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode);
  const [prefersLight, setPrefersLight] = useState(() => {
    try {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    } catch {
      return false;
    }
  });

  // Reflect the chosen mode on <html> (data-theme) and persist it.
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    localStorage.setItem('bm-theme', mode);
  }, [mode]);

  // Track the OS preference so "system" mode renders the right theme.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setPrefersLight(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const effectiveTheme: 'light' | 'dark' = mode === 'system' ? (prefersLight ? 'light' : 'dark') : mode;

  const cycle = () => setMode((m) => (m === 'system' ? 'light' : m === 'light' ? 'dark' : 'system'));

  return { mode, effectiveTheme, cycle };
}

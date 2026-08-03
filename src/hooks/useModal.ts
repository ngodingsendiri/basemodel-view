import { useEffect } from 'react';
import { useFocusTrap } from './useFocusTrap';

export function useModal(enabled: boolean, onClose: () => void) {
  const containerRef = useFocusTrap(enabled);

  // Close on Escape.
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onClose]);

  // Lock body scroll while open. Focus capture/restore is handled by the trap.
  useEffect(() => {
    if (!enabled) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [enabled]);

  return containerRef;
}

import { useState, useCallback } from 'react';
import type { CanonicalModel, Offering } from '../schemas/api';

export function useModelDetailModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [model, setModel] = useState<CanonicalModel | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);

  const open = useCallback((nextModel: CanonicalModel, nextOfferings: Offering[]) => {
    setModel(nextModel);
    setOfferings(nextOfferings);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setOfferings([]);
  }, []);

  return { isOpen, model, offerings, open, close };
}

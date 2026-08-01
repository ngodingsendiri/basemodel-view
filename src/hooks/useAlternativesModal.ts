import { useState, useCallback } from 'react';
import type { Model, Alternative } from '../schemas/api';

export function useAlternativesModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [originalModel, setOriginalModel] = useState<Model | null>(null);
  const [selectedAlternatives, setSelectedAlternatives] = useState<Alternative[]>([]);

  const open = useCallback((model: Model, alts: Alternative[]) => {
    setOriginalModel(model);
    setSelectedAlternatives(alts);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedAlternatives([]);
  }, []);

  return { isOpen, originalModel, selectedAlternatives, open, close };
}
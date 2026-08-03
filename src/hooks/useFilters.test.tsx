import { describe, it, expect } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router';
import type { ReactNode } from 'react';
import { useFilters } from './useFilters';
import { providerId } from '../domain/branded';

function wrapperWithUrl(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useFilters', () => {
  it('initializes from URL params', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: wrapperWithUrl('/?provider=openai&q=gpt&free=true&sort=context'),
    });

    expect(result.current.selectedProviderId).toBe('openai');
    expect(result.current.searchQuery).toBe('gpt');
    expect(result.current.debouncedSearchQuery).toBe('gpt');
    expect(result.current.freeOnly).toBe(true);
    expect(result.current.sortKey).toBe('context');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('defaults when URL has no params', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: wrapperWithUrl('/'),
    });

    expect(result.current.selectedProviderId).toBe('all');
    expect(result.current.searchQuery).toBe('');
    expect(result.current.freeOnly).toBe(false);
    expect(result.current.sortKey).toBe('name');
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('reports active filters as state changes', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: wrapperWithUrl('/'),
    });

    expect(result.current.hasActiveFilters).toBe(false);

    act(() => result.current.setSelectedProviderId(providerId('openai')));
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => result.current.setSearchQuery('gpt'));
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => result.current.setFreeOnly(true));
    act(() => result.current.setSortKey('price'));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clearFilters resets all filters to defaults', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: wrapperWithUrl('/?provider=openai&q=gpt&free=true&sort=context'),
    });

    act(() => result.current.clearFilters());

    expect(result.current.selectedProviderId).toBe('all');
    expect(result.current.searchQuery).toBe('');
    expect(result.current.freeOnly).toBe(false);
    expect(result.current.sortKey).toBe('name');
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('synces filter changes back to the URL, preserving unrelated params', async () => {
    function Harness() {
      const filters = useFilters();
      const [params] = useSearchParams();
      return (
        <div>
          <button type="button" onClick={() => filters.setSelectedProviderId(providerId('anthropic'))}>
            set-provider
          </button>
          <button type="button" onClick={() => filters.setSortKey('date')}>
            set-sort
          </button>
          <span data-testid="url">{params.toString()}</span>
        </div>
      );
    }

    render(<Harness />, {
      wrapper: wrapperWithUrl('/?alt=openai%2Fgpt-4o'),
    });

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('alt=openai%2Fgpt-4o'));

    act(() => screen.getByText('set-provider').click());
    await waitFor(() =>
      expect(screen.getByTestId('url')).toHaveTextContent('provider=anthropic')
    );
    expect(screen.getByTestId('url')).toHaveTextContent('alt=openai%2Fgpt-4o');

    act(() => screen.getByText('set-sort').click());
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('sort=date'));
    expect(screen.getByTestId('url')).toHaveTextContent('alt=openai%2Fgpt-4o');
    expect(screen.getByTestId('url')).toHaveTextContent('provider=anthropic');
  });
});

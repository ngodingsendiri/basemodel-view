import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useModal } from './useModal';

function Harness({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const ref = useModal(enabled, onClose);
  return (
    <div ref={ref} data-testid="dialog">
      <button>First</button>
      <button>Last</button>
    </div>
  );
}

describe('useModal', () => {
  it('does nothing while disabled', () => {
    const onClose = vi.fn();
    render(<Harness enabled={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe('');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape while enabled', () => {
    const onClose = vi.fn();
    render(<Harness enabled onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while enabled and unlocks when disabled', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness enabled={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe('');

    rerender(<Harness enabled onClose={onClose} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Harness enabled={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('moves focus into the dialog on open and restores it on close', () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(<Harness enabled onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    rerender(<Harness enabled={false} onClose={onClose} />);
    expect(trigger).toHaveFocus();

    trigger.remove();
  });

  it('wraps Tab focus between the first and last focusable elements', () => {
    const onClose = vi.fn();
    render(<Harness enabled onClose={onClose} />);
    const dialog = screen.getByTestId('dialog');

    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });
});

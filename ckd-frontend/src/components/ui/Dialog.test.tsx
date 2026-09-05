import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';

/**
 * The modal is built on the native `<dialog>`, so most of what a modal has to get
 * right — top layer, focus trap, focus restoration, the rest of the page removed
 * from the accessibility tree — is the platform's job rather than this component's.
 *
 * What is tested here is the part that is *not* free: that the element's own state
 * and the React state that owns `open` cannot drift apart, and that every documented
 * way out actually calls `onClose`.
 */

function Harness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open sections</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Sections"
        description="Jump to any part of the product."
      >
        <a href="#learn">Learn</a>
      </Dialog>
    </div>
  );
}

describe('Dialog', () => {
  it('takes its accessible name and description from props', () => {
    render(<Dialog open onClose={() => {}} title="Sections" description="Jump to any part." />);
    const dialog = screen.getByRole('dialog', { name: 'Sections' });
    expect(dialog).toHaveAccessibleDescription('Jump to any part.');
  });

  it('is open in the DOM only when the prop says so', () => {
    const { rerender } = render(<Dialog open={false} onClose={() => {}} title="Sections" />);
    const dialog = document.querySelector('dialog');
    expect(dialog?.open).toBe(false);

    rerender(<Dialog open onClose={() => {}} title="Sections" />);
    expect(document.querySelector('dialog')?.open).toBe(true);

    rerender(<Dialog open={false} onClose={() => {}} title="Sections" />);
    expect(document.querySelector('dialog')?.open).toBe(false);
  });

  it('closes through React state, so the element and the state cannot disagree', async () => {
    render(<Harness />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open sections' }));
    expect(document.querySelector('dialog')?.open).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('dialog')?.open).toBe(false);
  });

  it('routes the native Escape through onClose instead of closing itself', () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Sections" />);
    const dialog = document.querySelector('dialog');

    // `cancel` is what the browser fires for Escape. It is dispatched directly
    // because jsdom does not generate it from a key press — the behaviour under
    // test is the handler, not the platform's key mapping.
    fireEvent(dialog as Element, new Event('cancel', { bubbles: false, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    // Default prevented: letting the element close itself would leave React's
    // `open` still true, and the next render would be a no-op.
    expect(dialog?.open).toBe(true);
  });

  it('treats a click on the element itself as a backdrop click', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Sections">
        <a href="#learn">Learn</a>
      </Dialog>
    );

    await userEvent.click(screen.getByRole('link', { name: 'Learn' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('dialog') as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not leave a top-layer element behind when unmounted while open', () => {
    const { unmount } = render(<Dialog open onClose={() => {}} title="Sections" />);
    expect(document.querySelector('dialog')?.open).toBe(true);
    unmount();
    expect(document.querySelector('dialog')).toBeNull();
  });
});

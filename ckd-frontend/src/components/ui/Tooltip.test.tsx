import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';

/**
 * Tooltip behaviour, including its timing.
 *
 * The Phase 0 audit traced two hanging tests in the old `NumericInput` suite to one
 * pattern: `vi.useFakeTimers()` active while the assertion used `waitFor`. `waitFor`
 * polls on timers, so with the clock frozen and never advanced it polls forever and
 * fails at the five-second timeout — a test that looks flaky and is in fact
 * deterministic.
 *
 * Three rules follow, and this file demonstrates all three:
 *
 * 1. **Interaction tests pass `delayMs={0}` and use real timers.** No fake clock, no
 *    `waitFor`, nothing to advance. This is the common case.
 * 2. **The tests that check the delay itself own the clock and drive it with
 *    `fireEvent`,** which is synchronous. `user-event` schedules its own timeouts
 *    between the events it dispatches, so pairing it with a frozen clock deadlocks
 *    the two against each other; the delay under test belongs to the component, not
 *    to the pointer simulation, so the simpler dispatcher is the correct one here.
 * 3. **`waitFor` appears nowhere in this file.** Every state change is either awaited
 *    through `user-event` or produced by an explicit `act` + clock advance.
 */

const HELP = 'SHAP shows how much each answer moved this score.';

describe('Tooltip', () => {
  it('gives the trigger a name that says what it explains', () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        {HELP}
      </Tooltip>
    );
    // An icon-only trigger announced as "button" is unusable, and it is the single
    // most common defect in tooltip implementations.
    expect(screen.getByRole('button', { name: 'What is SHAP?' })).toBeVisible();
  });

  it('shows nothing until asked', () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        {HELP}
      </Tooltip>
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('button', { name: 'What is SHAP?' })).not.toHaveAttribute(
      'aria-describedby'
    );
  });

  it('opens on focus with no delay, because a keyboard user cannot hover', async () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={5000}>
        {HELP}
      </Tooltip>
    );
    const user = userEvent.setup();

    // Note the 5-second hover delay: focus must ignore it entirely. If focus were
    // routed through the same timer, tabbing to the trigger would appear to do
    // nothing.
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'What is SHAP?' });
    expect(trigger).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent(HELP);
    expect(trigger).toHaveAccessibleDescription(HELP);
  });

  it('closes on blur', async () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        {HELP}
      </Tooltip>
    );
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('tooltip')).toBeVisible();

    await user.tab();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes on Escape while the trigger still has focus', async () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        {HELP}
      </Tooltip>
    );
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('tooltip')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
    // Escape dismisses the tooltip, not the focus: the user is still on the trigger
    // and can reopen it without re-navigating.
    expect(screen.getByRole('button', { name: 'What is SHAP?' })).toHaveFocus();
  });

  it('opens on hover once the delay is zero', async () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        {HELP}
      </Tooltip>
    );
    const user = userEvent.setup();

    await user.hover(screen.getByRole('button', { name: 'What is SHAP?' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(HELP);

    await user.unhover(screen.getByRole('button', { name: 'What is SHAP?' }));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('toggles on tap, so the pattern works on a device that cannot hover', async () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        {HELP}
      </Tooltip>
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'What is SHAP?' });

    // A real tap emits pointerdown, then a *compatibility* mouseenter, then focus,
    // then click. An implementation that opens on mouseenter and toggles on click
    // opens and closes inside one tap, leaving the help text unreachable on a phone.
    await user.pointer({ keys: '[TouchA]', target: trigger });
    expect(screen.getByRole('tooltip')).toHaveTextContent(HELP);

    await user.pointer({ keys: '[TouchA]', target: trigger });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not open from a touch hover, which is not a hover at all', () => {
    const { container } = render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        {HELP}
      </Tooltip>
    );

    // A finger arriving over the trigger, before any press. `user-event` cannot
    // express this: it brings a touch pointer into existence only on press, so
    // naming one here throws. The event is therefore dispatched directly —
    // `pointerOver` rather than `pointerEnter`, for the reason documented in the
    // delay block below.
    fireEvent.pointerOver(container.firstElementChild as Element, {
      pointerType: 'touch',
      relatedTarget: null,
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('lets an impatient mouse user click through the delay', async () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={5000}>
        {HELP}
      </Tooltip>
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'What is SHAP?' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(HELP);
  });

  /**
   * The only tests in the suite that use a fake clock.
   *
   * They exist because the delay is a real behaviour — a tooltip that opens on the
   * first pixel of pointer travel flickers across a form of 24 fields — and the
   * delay cannot be observed without controlling time.
   *
   * Events are dispatched with `fireEvent`, synchronously. `user-event` awaits its
   * own scheduled timeouts between the events it sends, so a frozen clock and an
   * awaiting simulator wait on each other and the test times out at five seconds —
   * a slower rediscovery of the same defect this file exists to prevent.
   */
  describe('the hover delay itself', () => {
    /**
     * A mouse arriving over and leaving the wrapper.
     *
     * `pointerover`/`pointerout` rather than `pointerenter`/`pointerleave`: React
     * does not listen for the enter and leave events at all. It derives
     * `onPointerEnter` and `onPointerLeave` from the over/out pair, so dispatching
     * the enter event directly is silently ignored.
     */
    const mouseEnter = (element: Element) =>
      fireEvent.pointerOver(element, { pointerType: 'mouse', relatedTarget: null });
    const mouseLeave = (element: Element) =>
      fireEvent.pointerOut(element, { pointerType: 'mouse', relatedTarget: null });

    it('waits for the delay before opening, and not longer', () => {
      vi.useFakeTimers();
      try {
        const { container } = render(
          <Tooltip label="What is SHAP?" delayMs={500}>
            {HELP}
          </Tooltip>
        );
        const wrapper = container.firstElementChild as Element;

        mouseEnter(wrapper);
        // Still closed: the timer has been set, not fired.
        expect(screen.queryByRole('tooltip')).toBeNull();

        // Advanced inside `act` so React flushes the resulting state update before
        // the assertion. No `waitFor` — there is nothing to wait for, the clock is
        // ours.
        act(() => void vi.advanceTimersByTime(499));
        expect(screen.queryByRole('tooltip')).toBeNull();

        act(() => void vi.advanceTimersByTime(1));
        expect(screen.getByRole('tooltip')).toHaveTextContent(HELP);
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancels a pending open when the pointer leaves first', () => {
      vi.useFakeTimers();
      try {
        const { container } = render(
          <Tooltip label="What is SHAP?" delayMs={500}>
            {HELP}
          </Tooltip>
        );
        const wrapper = container.firstElementChild as Element;

        mouseEnter(wrapper);
        mouseLeave(wrapper);
        act(() => void vi.advanceTimersByTime(2000));

        // A tooltip that appears after the pointer has moved on is a tooltip that
        // appears over whatever the user went to read next.
        expect(screen.queryByRole('tooltip')).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('leaves no timer behind when it is unmounted mid-delay', () => {
      vi.useFakeTimers();
      try {
        const { container, unmount } = render(
          <Tooltip label="What is SHAP?" delayMs={500}>
            {HELP}
          </Tooltip>
        );

        mouseEnter(container.firstElementChild as Element);
        expect(vi.getTimerCount()).toBe(1);
        unmount();

        // A surviving timer would call setState on a dead component. Asserted by
        // the count rather than by watching for a warning, because a warning can be
        // swallowed and a pending timer cannot.
        act(() => void vi.advanceTimersByTime(2000));
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CircleQuestionMark } from 'lucide-react';
import { cn } from '../../lib/cn';
import { HIT_AREA_44 } from './styles';

interface TooltipProps {
  /** The trigger's accessible name — what this explains, e.g. "What is SHAP?". */
  label: string;
  children: ReactNode;
  /**
   * Hover delay. Exposed as a prop for one reason: tests pass `0` and assert
   * against real timers.
   *
   * The Phase 0 audit traced two hanging tests to `vi.useFakeTimers()` combined
   * with `waitFor`, which polls timers that the test never advances. Making the
   * delay a parameter removes the need for fake timers in the common case, and the
   * one test that does check the delay drives it explicitly.
   */
  delayMs?: number;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * An explanatory tooltip on a dedicated icon trigger.
 *
 * It renders its own button rather than wrapping an arbitrary child, which
 * guarantees the trigger is keyboard-focusable and has a name — the two things
 * hover-only tooltips usually get wrong.
 *
 * The three input modes are handled separately on purpose, because a single
 * "hover or click" handler cannot serve them all. A touch tap emits, in order:
 * `pointerdown`, then a *compatibility* `mouseenter`, then `focus`, then `click`.
 * A tooltip that opens on `mouseenter` and toggles on `click` therefore opens and
 * closes within one tap, and the help text is unreachable on a phone — which is the
 * device this product is designed for first.
 *
 * So: hover is read from **pointer** events and only for a real hovering device;
 * focus opens immediately, except when the focus was caused by a pointer press,
 * which lets the click decide; and the click is a pure toggle over the previous
 * state, so it cannot act on a stale closure.
 */
export function Tooltip({ label, children, delayMs = 500, side = 'bottom', className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while a pointer press is in flight, so `focus` defers to `click`. */
  const pressed = useRef(false);
  const tooltipId = `tooltip-${useId()}`;

  const cancelPending = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Unmounting mid-delay must not leave a timer that calls setState on a dead
  // component — the usual source of "update on unmounted component" noise.
  useEffect(() => cancelPending, [cancelPending]);

  const openAfterDelay = () => {
    cancelPending();
    if (delayMs <= 0) {
      setOpen(true);
      return;
    }
    timer.current = setTimeout(() => setOpen(true), delayMs);
  };

  const close = () => {
    cancelPending();
    setOpen(false);
  };

  /** `pen` hovers like a mouse; `touch` does not hover at all. */
  const hovers = (pointerType: string) => pointerType === 'mouse' || pointerType === 'pen';

  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={(event) => {
        if (hovers(event.pointerType)) openAfterDelay();
      }}
      onPointerLeave={(event) => {
        if (hovers(event.pointerType)) close();
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-full text-ink-subtle hover:text-accent-ink',
          HIT_AREA_44
        )}
        onPointerDown={() => {
          pressed.current = true;
        }}
        onFocus={() => {
          // A keyboard user should not have to wait out a hover delay. A pointer
          // user's focus is part of a tap or click, and the click decides.
          if (pressed.current) return;
          cancelPending();
          setOpen(true);
        }}
        onBlur={() => {
          pressed.current = false;
          close();
        }}
        onClick={() => {
          pressed.current = false;
          cancelPending();
          setOpen((previous) => !previous);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
      >
        <CircleQuestionMark aria-hidden className="size-4.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          className={cn(
            'absolute z-30 w-64 max-w-[min(16rem,calc(100vw-2rem))] rounded-md border border-border',
            'bg-surface p-3 text-sm font-normal text-ink shadow-overlay',
            side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
            'start-0'
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}

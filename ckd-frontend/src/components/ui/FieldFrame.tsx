import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface FieldFrameProps {
  inputId: string;
  label: ReactNode;
  /** Standing help: a normal range, a unit, where to find the value. */
  hint?: ReactNode;
  hintId: string;
  /** Present only when the value is invalid — never for a missing value. */
  error?: string;
  errorId: string;
  /**
   * Marks the field as answerable-later rather than required. Every field in this
   * product is optional at the API level (a missing value is imputed and
   * disclosed), so "optional" is the honest default and the badge says so.
   */
  optional?: boolean;
  tooltip?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Label, control, hint, and error — wired together.
 *
 * The wiring is the component's whole purpose, so it is done in one place rather
 * than at 24 call sites: a real `<label for>`, `aria-describedby` pointing at the
 * error *and* the hint, and `role="alert"` on the error so it is announced when it
 * appears rather than only when the field is next focused.
 */
export function FieldFrame({
  inputId,
  label,
  hint,
  hintId,
  error,
  errorId,
  optional = false,
  tooltip,
  children,
  className,
}: FieldFrameProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
        {optional && (
          <span className="text-xs text-ink-subtle">Optional</span>
        )}
        {tooltip}
      </div>

      {children}

      {hint && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}

      {/*
        `role="alert"` rather than a plain paragraph: the error appears after the
        user has moved on, and without a live region it is announced only if they
        happen to return to the field. Rendered conditionally so an empty region
        is never announced.
      */}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

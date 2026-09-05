import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

interface LoadingStateProps {
  /** What is loading, in words. Announced politely, and shown unless `quiet`. */
  label: string;
  /** Skeletons or any placeholder shape. Rendered inside the live region. */
  children?: ReactNode;
  /** Hide the visible label and keep only the announcement. */
  quiet?: boolean;
  className?: string;
}

/**
 * The one place a "still working" announcement is made.
 *
 * `aria-live="polite"` with `aria-busy` on the same element: politeness so it waits
 * for the user to finish what they were saying or reading, and `aria-busy` so an
 * assistive technology that batches updates knows the region is mid-change rather
 * than merely empty. Both are needed; neither implies the other.
 */
export function LoadingState({ label, children, quiet = false, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className={cn('space-y-3', className)}
    >
      <span className={cn('flex items-center gap-2 text-sm text-ink-muted', quiet && 'sr-only')}>
        {!quiet && <Spinner size="sm" />}
        {label}
      </span>
      {children}
    </div>
  );
}

import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
}

/**
 * A placeholder shape for content whose size is known before its value is.
 *
 * Always `aria-hidden`. A skeleton is a picture of absent data, and a screen
 * reader announcing "blank blank blank" is strictly worse than silence — the
 * announcement is the job of the `LoadingState` that wraps it.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'block animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none',
        className
      )}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/**
 * Stacked line placeholders. The last line is short, because real prose rarely
 * fills its final line and an even block reads as a table rather than as text.
 */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  const count = Math.max(1, Math.trunc(lines));

  return (
    <span aria-hidden className={cn('block space-y-2', className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn('h-4', index === count - 1 && count > 1 && 'w-3/5')} />
      ))}
    </span>
  );
}

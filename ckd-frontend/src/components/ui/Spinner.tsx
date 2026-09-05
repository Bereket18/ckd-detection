import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZES: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-8',
};

interface SpinnerProps {
  /**
   * When given, the spinner announces itself as a live region. Omit it when the
   * surrounding component already says what is loading — two announcements for one
   * event is worse than none.
   */
  label?: string;
  size?: SpinnerSize;
  className?: string;
}

/**
 * A rotating indicator for work that is already in progress.
 *
 * `motion-reduce:animate-none` is not a nicety: a continuously rotating element is
 * a documented vestibular trigger, and the fallback (a static ring) still reads as
 * "busy" because it never appears except while busy.
 */
export function Spinner({ label, size = 'md', className }: SpinnerProps) {
  const icon = (
    <LoaderCircle
      aria-hidden
      className={cn('animate-spin motion-reduce:animate-none', SIZES[size], className)}
    />
  );

  if (label === undefined) return icon;

  return (
    <span role="status" className="inline-flex items-center gap-2">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}

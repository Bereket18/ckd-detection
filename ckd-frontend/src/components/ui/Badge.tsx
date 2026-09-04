import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { TONE_CHIP, type StatusTone } from './styles';

interface BadgeProps {
  tone?: StatusTone;
  /** A glyph, when the badge needs to be readable without its colour. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A small, non-interactive label for a count, a category, or a band name.
 *
 * `Badge` carries no provenance meaning — that is `StatusLabel`'s job, and the two
 * must not be confused. If what you are labelling is *where a number came from*,
 * use `StatusLabel`; if it is a property of the number itself (a risk band, a field
 * count), use `Badge`.
 */
export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_CHIP[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

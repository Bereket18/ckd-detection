import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  title: ReactNode;
  /** Why it is empty and what would fill it. Both halves matter. */
  description?: ReactNode;
  /** Defaults to a tray glyph. Pass a subject-specific icon where one helps. */
  icon?: ReactNode;
  /** The action that would resolve the emptiness, when there is one. */
  action?: ReactNode;
  className?: string;
}

/**
 * Nothing to show, and that is not an error.
 *
 * Kept distinct from `ErrorState` because conflating them is how a product tells a
 * user something is broken when they simply have not entered anything yet. An empty
 * state gets neutral tone and no alert role; the region is `status`-free because
 * absence is not an event.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong',
        'bg-surface px-6 py-10 text-center',
        className
      )}
    >
      <span className="text-ink-subtle">
        {icon ?? <Inbox aria-hidden className="size-8" />}
      </span>
      <p className="text-base font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-(--container-prose) text-sm text-ink-muted">{description}</p>
      )}
      {action}
    </div>
  );
}

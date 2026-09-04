import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface PageHeaderProps {
  /** The page's `<h1>`. Exactly one per route. */
  title: ReactNode;
  /**
   * A short statement of what the page is for. Present on every route because a
   * heading alone rarely tells a patient whether they are in the right place.
   */
  description?: ReactNode;
  /** Small label above the title — a section name, not a breadcrumb. */
  eyebrow?: ReactNode;
  /** Status labels and provenance chips belong here, next to the title. */
  aside?: ReactNode;
  /** Primary actions for the page. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The top of a route.
 *
 * Uniform on every page for an accessibility reason rather than an aesthetic one:
 * a screen reader user navigating by heading arrives at `h1`, and the description
 * immediately after it answers "what is this" before they have to explore. The
 * `aside` slot sits beside the title so provenance is read as part of the page's
 * identity, not discovered halfway down.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  aside,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-4 border-b border-border pb-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {eyebrow && (
            <p className="text-sm font-medium tracking-wide text-ink-subtle uppercase">{eyebrow}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
            {aside}
          </div>
          {description && (
            <p className="max-w-(--container-prose) text-base text-ink-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

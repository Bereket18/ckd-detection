import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Status labels or a count. */
  aside?: ReactNode;
  actions?: ReactNode;
  /**
   * Heading rank. Passed explicitly rather than inferred from nesting depth: a
   * component cannot know where it will be mounted, and a skipped rank is a real
   * navigation failure for a screen reader (R7.6).
   */
  level?: 2 | 3 | 4;
  /** Links the section's region to this heading when the caller needs the id. */
  id?: string;
  className?: string;
}

/**
 * A heading for a block within a page.
 *
 * Deliberately separate from `CardHeader`: not every section is a card, and the
 * habit of wrapping each heading in a bordered panel is what makes a clinical tool
 * read as an admin dashboard.
 */
export function SectionHeader({
  title,
  description,
  aside,
  actions,
  level = 2,
  id,
  className,
}: SectionHeaderProps) {
  const Heading = `h${level}` as const;
  const size = level === 2 ? 'text-2xl' : level === 3 ? 'text-xl' : 'text-lg';

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Heading id={id} className={cn(size, 'font-semibold tracking-tight text-ink')}>
            {title}
          </Heading>
          {aside}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="max-w-(--container-prose) text-sm text-ink-muted">{description}</p>
      )}
    </div>
  );
}

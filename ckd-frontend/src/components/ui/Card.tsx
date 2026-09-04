import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { cardClasses } from './styles';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Renders as `<section>` when given a heading, so the card is navigable. */
  as?: 'div' | 'section' | 'article';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
} as const;

/**
 * A bordered surface.
 *
 * Used sparingly on purpose. A page built from eight cards reads as an admin
 * dashboard and gives every block the same importance; most content here belongs
 * in a plain `<section>` with a heading and whitespace. Reach for `Card` when the
 * grouping is real — a result panel, a driver list, a metric block.
 */
export function Card({ as: Tag = 'div', padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <Tag {...rest} className={cardClasses(cn(PADDING[padding], className))}>
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Status chip, action button, or anything that belongs on the title row. */
  aside?: ReactNode;
  /** Heading level. Pick the one the document outline needs, not the size. */
  level?: 2 | 3 | 4;
  className?: string;
}

export function CardHeader({
  title,
  description,
  aside,
  level = 3,
  className,
}: CardHeaderProps) {
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4';

  return (
    <div className={cn('mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0 space-y-1">
        <Heading className="text-lg font-semibold text-ink">{title}</Heading>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
    </div>
  );
}

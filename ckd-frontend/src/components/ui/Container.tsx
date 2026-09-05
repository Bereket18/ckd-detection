import type { ElementType, ReactNode } from 'react';
import { containerClasses, type ContainerWidth } from './styles';

interface ContainerProps {
  width?: ContainerWidth;
  as?: Extract<ElementType, 'div' | 'section' | 'header' | 'footer' | 'main' | 'nav'>;
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal page rhythm: one max-width and one set of gutters, chosen by intent
 * rather than by number.
 *
 * Naming the widths (`prose`, `form`, `content`, `wide`) instead of passing
 * `max-w-4xl` at each call site is what keeps line length legible — a reading page
 * and a data table want different measures, and a numeric class at the call site
 * loses the reason.
 */
export function Container({
  width = 'content',
  as: Tag = 'div',
  children,
  className,
}: ContainerProps) {
  return <Tag className={containerClasses(width, className)}>{children}</Tag>;
}

/**
 * Class-name joiner.
 *
 * Five lines instead of `clsx` + `tailwind-merge`, which together would add two
 * dependencies to do this and resolve utility conflicts. Conflicts are avoided by
 * convention instead: every primitive appends the caller's `className` last, so
 * the caller wins by CSS-order, and no primitive hardcodes a colour or spacing
 * utility that a page is likely to need to override.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

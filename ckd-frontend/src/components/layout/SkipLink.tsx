/**
 * Skip link.
 *
 * The first focusable element in the document and, on a page with a 12-item nav,
 * the difference between reaching the content in one keystroke and in fifteen
 * (WCAG 2.4.1). Visually hidden until focused — `sr-only` plus a `focus:` reset
 * rather than `display: none`, which would make it unfocusable and therefore
 * pointless.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-accent px-4 py-2 font-medium text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50"
    >
      Skip to main content
    </a>
  );
}

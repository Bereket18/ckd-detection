import { useEffect } from 'react';

/** Appended to every page title. Matches the `<title>` in `index.html`. */
export const TITLE_SUFFIX = 'EthioCKD';

/**
 * Set `document.title` for the life of a mounted route.
 *
 * A single-page application changes the URL without a document load, so nothing
 * updates the title unless something does it explicitly — and the title is what a
 * screen reader announces on navigation, what the tab strip shows when several
 * pages are open, and what a bookmark is named. Leaving it static is a real
 * accessibility defect, not a cosmetic one (R7.6).
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title === TITLE_SUFFIX ? title : `${title} · ${TITLE_SUFFIX}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useDocumentTitle } from '../lib/use-document-title';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { buttonClasses } from '../components/ui/styles';

/**
 * The catch-all route.
 *
 * A real page with an `<h1>`, not a bare line of text: it is reached by mistyped
 * URLs and stale links, and a screen-reader user needs the same landmark structure
 * here as anywhere else. It offers the two things a lost visitor actually wants —
 * the overview and the assessment — rather than only a back link.
 */
export default function NotFoundRoute() {
  useDocumentTitle('Page not found');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Page not found"
        description="The address you followed does not match anything on this site. It may have been mistyped, or the page may have moved."
      />
      <EmptyState
        icon={<SearchX aria-hidden className="size-8" />}
        title="Nothing here"
        description="Nothing you entered has been lost — an assessment in progress is still in this tab."
        action={
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Link to="/" className={buttonClasses('primary', 'md')}>
              Go to the overview
            </Link>
            <Link to="/assessment" className={buttonClasses('secondary', 'md')}>
              Start an assessment
            </Link>
          </div>
        }
      />
    </div>
  );
}

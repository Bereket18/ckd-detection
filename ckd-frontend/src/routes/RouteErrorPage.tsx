import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { useDocumentTitle } from '../lib/use-document-title';
import { devLogFailure } from '../lib/log';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { buttonClasses } from '../components/ui/styles';
import NotFoundRoute from './NotFoundRoute';

/**
 * The router's `errorElement`.
 *
 * Mounted on the child routes as well as the root, so a page that throws is replaced
 * while the header, navigation, and footer survive — a crash that also removes the
 * way out is two failures instead of one.
 *
 * A 404 thrown by the router is delegated to the real not-found page rather than
 * dressed up as an error. Everything else gets a generic explanation: the thrown
 * value is never rendered, because a router error can carry a server response body,
 * and this application's server responses can contain absolute filesystem paths.
 */
export default function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundRoute />;
  }

  return <UnexpectedRouteError error={error} />;
}

function UnexpectedRouteError({ error }: { error: unknown }) {
  useDocumentTitle('Something went wrong');
  devLogFailure('route error', error instanceof Error ? error.name : 'unknown');

  return (
    <div className="space-y-8">
      <PageHeader
        title="This page could not be shown"
        description="Something failed while loading it. Nothing you entered has been sent anywhere, and no result is being displayed."
      />
      <div role="alert" className="flex flex-wrap items-center gap-2">
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
        <Link to="/" className={buttonClasses('secondary', 'md')}>
          Go to the overview
        </Link>
      </div>
    </div>
  );
}

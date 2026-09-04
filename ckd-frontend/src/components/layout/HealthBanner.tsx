import { useHealth } from '../../lib/query/hooks';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';

/**
 * Service availability, stated once at the top of the application.
 *
 * Three deliberate choices:
 *
 * - **Silent when healthy, and silent while checking.** A banner that appears for
 *   400 ms on every load teaches users to ignore banners. The first probe is
 *   allowed to finish before anything is claimed.
 * - **`degraded` is not `unreachable`.** The API answers a degraded health probe
 *   with HTTP **200**, so the request succeeding proves nothing about whether the
 *   model can score a patient. The two states get different wording because the
 *   user's options differ: wait, versus check your connection.
 * - **The backend's `detail` string is never shown.** On a degraded probe it can
 *   carry `ArtifactLoadError` text containing an absolute filesystem path. The
 *   wording here is the frontend's own.
 *
 * `role="status"`/polite comes from `Alert`, which matters for a banner driven by a
 * 60-second poll: assertive would interrupt a screen reader once a minute.
 */
export function HealthBanner() {
  const health = useHealth();

  if (health.state === 'checking' || health.state === 'ready') return null;

  const degraded = health.state === 'degraded';

  return (
    <div className="border-b border-warn/30 bg-warn-soft no-print">
      <Container className="py-3">
        <Alert
          tone="warn"
          title={
            degraded
              ? 'Screening is temporarily unavailable'
              : 'We cannot reach the screening service'
          }
          className="border-0 bg-transparent px-0 py-0"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={health.refetch}
              loading={health.isFetching}
              loadingLabel="Checking…"
            >
              Check again
            </Button>
          }
        >
          {degraded
            ? 'The service is running but its model is not loaded, so no new assessment can be scored right now. Everything else on this site still works.'
            : 'Check your internet connection. You can keep reading, but an assessment cannot be submitted until the service responds.'}
        </Alert>
      </Container>
    </div>
  );
}

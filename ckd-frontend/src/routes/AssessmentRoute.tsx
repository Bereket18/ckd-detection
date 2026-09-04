import { RouteShell } from '../components/layout/RouteShell';
import { AssessmentForm } from '../features/assessment/AssessmentForm';

/**
 * `/assessment`.
 *
 * The route is a thin wrapper: it owns the page's heading and purpose text, and the
 * form owns everything stateful. That split is what lets the form be tested by
 * mounting it directly, without a router.
 */
export default function AssessmentRoute() {
  return (
    <RouteShell
      title="Assessment"
      description="A short set of questions about your health and any recent lab results. Every question can be skipped — a missing value is estimated by the model, and your result lists exactly which values were estimated."
    >
      <AssessmentForm />
    </RouteShell>
  );
}

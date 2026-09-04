import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { EmptyState } from '../components/ui/EmptyState';
import { buttonClasses } from '../components/ui/styles';
import { usePredictionValue } from '../lib/state/prediction-context';

/**
 * `/results` — shell, with the no-prediction case already handled.
 *
 * The empty state is not a placeholder: it is the correct and permanent behaviour
 * for opening this URL directly, reloading the page, or returning after the tab was
 * closed. The prediction is held in memory only (ADR-13), so "there is nothing to
 * show" is a real state that must explain itself rather than render a blank page.
 */
export default function ResultsRoute() {
  const prediction = usePredictionValue();

  return (
    <RouteShell
      title="Your result"
      description="The risk band the model returned for the answers you gave, together with what it does and does not mean."
      planned={
        prediction === null
          ? undefined
          : [
              {
                title: 'Risk band and score presentation',
                detail:
                  'The band returned by the service, shown with wording that does not present the score as a calibrated probability. The band is never recalculated in the browser.',
              },
              {
                title: 'Estimated values, disclosed',
                detail:
                  'Which answers were left blank and therefore estimated by the model, and how that affects confidence in the result.',
              },
              {
                title: 'The service’s own disclaimer',
                detail:
                  'Rendered from the response’s disclaimer field, verbatim. The frontend does not write or paraphrase it.',
              },
              {
                title: 'Next steps and saving',
                detail:
                  'What to do with the result, and a way to keep a copy generated in the browser from the response already held — there is no server-side report endpoint.',
              },
            ]
      }
    >
      {prediction === null && (
        <EmptyState
          icon={<ClipboardList aria-hidden className="size-8" />}
          title="No result to show yet"
          description="Results are held only for as long as this tab is open, and are never saved to your device. Complete an assessment to see one."
          action={
            <Link to="/assessment" className={buttonClasses('primary', 'md', 'mt-1')}>
              Start an assessment
            </Link>
          }
        />
      )}
    </RouteShell>
  );
}

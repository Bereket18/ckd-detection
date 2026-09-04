import { Link } from 'react-router-dom';
import { ChartColumn } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { EmptyState } from '../components/ui/EmptyState';
import { buttonClasses } from '../components/ui/styles';
import { usePredictionValue } from '../lib/state/prediction-context';

/**
 * `/explainability` — shell.
 *
 * Same in-memory guard as Results: without a prediction there is nothing honest to
 * explain, and an example chart built from invented drivers would be the most
 * misleading thing on the site.
 */
export default function ExplainabilityRoute() {
  const prediction = usePredictionValue();

  return (
    <RouteShell
      title="What influenced your result"
      documentTitle="Explainability"
      description="The model reports which of your values pushed its estimate up or down. That is a description of the model’s reasoning, not a statement about your body."
      planned={
        prediction === null
          ? undefined
          : [
              {
                title: 'Drivers in the order returned',
                detail:
                  'Every driver the service sends, in the order it sends them, with the direction taken from the sign of its value. Neither the order nor the direction is recomputed in the browser.',
              },
              {
                title: 'Your value beside each driver',
                detail:
                  'The answer you gave for that measurement, shown next to the driver, so the explanation is anchored to something recognisable.',
              },
              {
                title: 'Chart plus table, always both',
                detail:
                  'A chart for shape and a table for exact figures. The chart is never the only representation — it is unusable with a screen reader and unreadable at 320 px.',
              },
              {
                title: 'What SHAP is, in plain words',
                detail:
                  'A short explanation of the method and its limits, including that a driver is not a cause.',
              },
            ]
      }
    >
      {prediction === null && (
        <EmptyState
          icon={<ChartColumn aria-hidden className="size-8" />}
          title="Nothing to explain yet"
          description="An explanation describes a specific result. Complete an assessment and this page will show what influenced it."
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

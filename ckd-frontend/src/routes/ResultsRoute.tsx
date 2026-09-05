import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FileText, Lightbulb, RotateCcw } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses } from '../components/ui/styles';
import { ImputationNotice } from '../features/results/ImputationNotice';
import { PatientSummary } from '../features/results/PatientSummary';
import { ResultPanel } from '../features/results/ResultPanel';
import { TechnicalPanel } from '../features/results/TechnicalPanel';
import { ViewSwitch } from '../features/results/ViewSwitch';
import type { ResultView } from '../content/patient-summary';
import { usePrediction } from '../lib/state/prediction-context';
import { clearDraft } from '../lib/storage/draft';

/**
 * `/results`.
 *
 * The page has two states and both are real. With no prediction it explains why
 * there is nothing to show — opening this URL directly, reloading, or coming back to
 * a closed tab all land here, because the prediction is held in memory only
 * (ADR-13). With one, it renders the response and nothing but the response.
 *
 * The response is rendered twice, in two registers, and the reader picks: plain
 * language for the person who answered the questions, technical detail for whoever
 * reads models. Both are the same object — the split is presentational, and nothing
 * shown in one view contradicts the other.
 *
 * What sits *outside* the switch is deliberate: the band, the imputation notice, the
 * service's own disclaimer, and the report link. Those must be seen under either
 * reading, so they are not behind a control.
 *
 * `explanation` and `disclaimer` are backend-authored and rendered verbatim. Nothing
 * on this page paraphrases them, and nothing recomputes the band.
 */
export default function ResultsRoute() {
  const { prediction, assessment, receivedAt, clearPrediction } = usePrediction();
  const [view, setView] = useState<ResultView>('plain');

  if (prediction === null) {
    return (
      <RouteShell
        title="Your result"
        description="The risk band the model returned for the answers you gave, together with what it does and does not mean."
      >
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
      </RouteShell>
    );
  }

  const totalFields = prediction.model.feature_count;

  return (
    <RouteShell
      title="Your result"
      description="What the model returned for the answers you gave. This is a screening signal, not a diagnosis — the wording throughout is chosen to keep that distinction visible."
      eyebrow={
        receivedAt === null
          ? undefined
          : `Produced at ${new Date(receivedAt).toLocaleTimeString()}`
      }
    >
      <ResultPanel prediction={prediction} />

      <ImputationNotice
        imputedFields={prediction.imputed_fields}
        imputationCount={prediction.imputation_count}
        totalFields={totalFields}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <ViewSwitch view={view} onChange={setView} />
        <p className="text-sm text-ink-subtle">
          {view === 'plain'
            ? 'Written for the person who answered the questions.'
            : 'The raw response, for whoever reads models.'}
        </p>
      </div>

      {view === 'plain' ? (
        <>
          <PatientSummary
            band={prediction.risk_band}
            imputationCount={prediction.imputation_count}
          />

          {/*
            The service writes its own patient-facing explanation. It is rendered as
            received or not at all — a paraphrase would be the frontend making a
            clinical statement, which is the one thing it must never do.
          */}
          {prediction.explanation !== null && prediction.explanation.trim() !== '' && (
            <Card padding="lg" as="section" aria-labelledby="explanation-heading">
              <CardHeader
                level={2}
                title={<span id="explanation-heading">What the service says about this</span>}
                description="Written by the screening service itself and shown word for word."
              />
              <p className="text-base whitespace-pre-line text-ink">{prediction.explanation}</p>
            </Card>
          )}

          <section aria-labelledby="next-heading" className="space-y-4">
            <SectionHeader
              id="next-heading"
              title="What to do with this"
              description="This tool cannot diagnose, order a test, or rule anything out. What it can do is tell you whether it is worth asking."
              actions={
                <Link to="/explainability" className={buttonClasses('secondary', 'sm')}>
                  <Lightbulb aria-hidden className="size-4" />
                  Which values mattered
                </Link>
              }
            />
            <Card padding="lg">
              <ol className="space-y-3 text-sm text-ink">
                <li>
                  <strong className="font-semibold">Take this to a clinician, not instead of one.</strong>{' '}
                  A blood test for creatinine and a urine test for protein are the two things
                  that actually establish kidney function. Both are routine and cheap.
                </li>
                <li>
                  <strong className="font-semibold">Bring your numbers, not this screen.</strong>{' '}
                  The values you entered are what a clinician can use. This result is held only
                  in this tab and disappears when you close it.
                </li>
                <li>
                  <strong className="font-semibold">Do not change any medication because of this.</strong>{' '}
                  Nothing here is a prescription, a dose, or a reason to stop something you were
                  told to take.
                </li>
              </ol>
            </Card>
          </section>
        </>
      ) : (
        <TechnicalPanel prediction={prediction} assessment={assessment} />
      )}

      {/* The service's own disclaimer, verbatim. Never edited, never summarised. */}
      <Alert tone="warn" title="From the screening service">
        {prediction.disclaimer}
      </Alert>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link to="/report" className={buttonClasses('primary', 'md')}>
          <FileText aria-hidden className="size-4" />
          Generate a report
        </Link>
        <Link to="/assessment" className={buttonClasses('secondary', 'md')}>
          Change my answers
        </Link>
        <Link
          to="/assessment"
          className={buttonClasses('ghost', 'md')}
          onClick={() => {
            // Discard both the result and the saved answers: "start over" that leaves
            // the previous result one Back navigation away has not started over.
            clearPrediction();
            clearDraft();
          }}
        >
          <RotateCcw aria-hidden className="size-4" />
          Start over
        </Link>
      </div>
    </RouteShell>
  );
}

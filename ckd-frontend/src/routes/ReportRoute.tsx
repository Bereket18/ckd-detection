import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Printer } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { buttonClasses } from '../components/ui/styles';
import { ReportDocument } from '../features/report/ReportDocument';
import { usePrediction } from '../lib/state/prediction-context';

/**
 * `/report`.
 *
 * The last step of the screening path: the result becomes a document a person can put
 * in front of a clinician. The backend has no report endpoint, so the document is
 * assembled in the browser from the response already in memory — which is also why it
 * can promise that nothing was uploaded to produce it.
 *
 * *Print* is the export. Every browser's print dialogue offers **Save as PDF**, so one
 * `window.print()` covers both paper and a file, with no PDF library shipped to the
 * user and no server round trip.
 *
 * The printed timestamp is the moment the *result* was received, taken from the
 * prediction context — not the moment this page rendered. Those differ by however
 * long the user spent reading, and the one that belongs on a clinical document is the
 * one that describes the result. There is deliberately no fallback clock read: if the
 * time is unknown, the document prints no time.
 */
export default function ReportRoute() {
  const { prediction, assessment, receivedAt } = usePrediction();
  const [printed, setPrinted] = useState(false);

  // The tab title becomes the default PDF filename in most browsers, so it is worth
  // being specific. Restored on unmount so the next route's title is not stale.
  useEffect(() => {
    if (prediction === null) return;
    const previous = document.title;
    document.title = `EthioCKD screening report · ${prediction.risk_band}`;
    return () => {
      document.title = previous;
    };
  }, [prediction]);

  if (prediction === null) {
    return (
      <RouteShell
        title="Screening report"
        description="A printable summary of one screening: the result, the values behind it, what influenced it most, and the service’s own limitations and disclaimer."
      >
        <EmptyState
          icon={<FileText aria-hidden className="size-8" />}
          title="No report to generate yet"
          description="A report describes a specific result, and results are held only for as long as this tab is open. Complete an assessment and the report is generated from it here."
          action={
            <Link to="/assessment" className={buttonClasses('primary', 'md', 'mt-1')}>
              Start an assessment
            </Link>
          }
        />
      </RouteShell>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        {/*
          No heading here on purpose. The document below carries the page's only `h1`
          — it is the page — and a second one above it would give the route two
          competing titles in the document outline.
        */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <p className="max-w-(--container-prose) text-ink-muted">
            Everything below is built from the response already held in this tab. Nothing
            was uploaded to produce it, and no copy is kept once the tab closes — so save
            or print it now if you want to keep it.
          </p>
          <Button
            variant="primary"
            icon={<Printer aria-hidden className="size-4" />}
            onClick={() => {
              setPrinted(true);
              window.print();
            }}
          >
            Print or save as PDF
          </Button>
        </div>

        <Alert tone="info" title="How to save this as a PDF">
          Choose <strong className="font-semibold text-ink">Print or save as PDF</strong>,
          then pick <em>Save as PDF</em> as the destination in the dialogue your browser
          opens. The application chrome — navigation, buttons, this notice — is left out of
          the printed document automatically.
        </Alert>

        {printed && (
          <Alert tone="success" title="Print dialogue opened">
            If nothing appeared, your browser may have blocked it — use its own File → Print
            menu, or press Ctrl+P.
          </Alert>
        )}
      </div>

      {/*
        The document renders identically on screen and on paper. A separate print-only
        copy would be two things to keep in step, and the one nobody looks at is the one
        that goes wrong.
      */}
      <div className="rounded-lg border border-border shadow-card print:rounded-none print:border-0 print:shadow-none">
        <ReportDocument
          prediction={prediction}
          assessment={assessment}
          generatedAt={receivedAt}
        />
      </div>

      <div className="no-print flex flex-wrap gap-3 border-t border-border pt-6">
        <Link to="/results" className={buttonClasses('secondary', 'md')}>
          Back to your result
        </Link>
        <Link to="/explainability" className={buttonClasses('ghost', 'md')}>
          See what influenced it
        </Link>
      </div>
    </div>
  );
}

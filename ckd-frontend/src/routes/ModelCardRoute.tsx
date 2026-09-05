import { Link } from 'react-router-dom';
import { Ban, ClipboardList, FlaskConical, Ruler, ShieldAlert, Target } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLabel } from '../components/provenance/StatusLabel';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SkeletonText } from '../components/ui/Skeleton';
import { buttonClasses } from '../components/ui/styles';
import { useModelMetadata } from '../lib/query/hooks';
import type { ModelMetrics, ModelView } from '../types/api.types';

/**
 * `/model-card` — the deployed model, described by the service.
 *
 * Everything factual on this page comes from `GET /model`. Nothing is recomputed and
 * nothing is filled in: a metric the service omits is absent here, because "not
 * reported" and "zero" are different statements and only one of them is true.
 *
 * Two labels carry the honesty. The identity block is VERIFIED — the service returned
 * it in this session. The metrics block is PROVISIONAL, and that is not modesty: they
 * were measured on eighty held-out rows from one public dataset, which is enough to
 * characterise the model and nowhere near enough to characterise clinical performance.
 * Presenting `accuracy 0.975` without that label would be the most misleading true
 * number on the site.
 *
 * The artefact table shows hashes only. `artifacts[*].path` is an absolute server path
 * and was dropped by the projection layer before this route received the document
 * (§8.3), so the page cannot render it even by mistake.
 */

interface MetricRow {
  key: keyof ModelMetrics;
  label: string;
  detail: string;
}

/**
 * Ordered for reading, not alphabetically: what it gets right overall, then the two
 * numbers that matter clinically, then the ones that qualify them.
 */
const METRIC_ROWS: readonly MetricRow[] = [
  { key: 'accuracy', label: 'Accuracy', detail: 'Share of test records classified correctly.' },
  {
    key: 'recall',
    label: 'Recall (sensitivity)',
    detail: 'Share of actual CKD records the model caught. Misses here are the costly kind.',
  },
  {
    key: 'specificity',
    label: 'Specificity',
    detail: 'Share of non-CKD records correctly cleared. It is what keeps recall honest.',
  },
  {
    key: 'precision',
    label: 'Precision',
    detail: 'Of the records it flagged, the share that were actually CKD.',
  },
  { key: 'f1', label: 'F1', detail: 'Balance of precision and recall, as a single number.' },
  {
    key: 'auc_roc',
    label: 'AUC-ROC',
    detail: 'How well the score separates the two classes across all thresholds.',
  },
  {
    key: 'brier_score',
    label: 'Brier score',
    detail: 'Error in the raw scores. Lower is better — and it is why the score is not called a probability.',
  },
];

function formatMetric(value: number | undefined): string {
  return value === undefined ? '—' : value.toFixed(3);
}

function MetricsTable({ metrics }: { metrics: ModelMetrics }) {
  const rows = METRIC_ROWS.filter((row) => typeof metrics[row.key] === 'number');
  const intervals = metrics.intervals ?? {};

  const columns: readonly Column<MetricRow>[] = [
    {
      key: 'label',
      header: 'Metric',
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-medium text-ink">{row.label}</span>
          <p className="mt-0.5 text-xs text-ink-muted">{row.detail}</p>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Reported',
      numeric: true,
      cell: (row) => formatMetric(metrics[row.key] as number | undefined),
    },
    {
      key: 'interval',
      header: '95% interval',
      numeric: true,
      cell: (row) => {
        const interval = intervals[row.key];
        return interval === undefined
          ? <span className="text-ink-subtle">not reported</span>
          : `${interval[0].toFixed(3)} – ${interval[1].toFixed(3)}`;
      },
    },
  ];

  return (
    <DataTable
      caption="Evaluation metrics as reported by the service, with the intervals it supplies"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      empty={
        <Alert tone="warn" title="No metrics reported">
          The service returned a model document without an evaluation block, so there is nothing
          to show here. Nothing has been substituted.
        </Alert>
      }
    />
  );
}

/**
 * The confusion matrix, labelled.
 *
 * The service produces it with scikit-learn's default orientation — rows are the
 * actual class, columns the predicted one, in ascending label order, so the positive
 * class (CKD) is the second of each. Anything that is not a 2×2 is shown as the raw
 * array rather than forced into that reading.
 */
function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const row0 = matrix[0];
  const row1 = matrix[1];
  const wellFormed =
    matrix.length === 2 && row0?.length === 2 && row1?.length === 2;

  if (!wellFormed || row0 === undefined || row1 === undefined) {
    return (
      <p className="font-mono text-sm break-words text-ink-muted">{JSON.stringify(matrix)}</p>
    );
  }

  const cells = [
    { label: 'Correctly cleared', sub: 'actual not CKD, called not CKD', value: row0[0] ?? 0, tone: 'text-success' },
    { label: 'False alarms', sub: 'actual not CKD, called CKD', value: row0[1] ?? 0, tone: 'text-warn' },
    { label: 'Missed cases', sub: 'actual CKD, called not CKD', value: row1[0] ?? 0, tone: 'text-danger' },
    { label: 'Correctly flagged', sub: 'actual CKD, called CKD', value: row1[1] ?? 0, tone: 'text-success' },
  ];

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-lg border border-border bg-surface-sunken p-3">
            <dt className="text-sm font-medium text-ink">{cell.label}</dt>
            <dd className={`mt-1 font-mono text-2xl tabular-nums ${cell.tone}`}>{cell.value}</dd>
            <p className="mt-1 text-xs text-ink-subtle">{cell.sub}</p>
          </div>
        ))}
      </dl>
      <p className="text-sm text-ink-muted">
        Read the missed-cases box first. On a test set this small, a single missed record moves
        recall by more than a percentage point — which is the honest way to hold a number like
        0.975.
      </p>
    </div>
  );
}

function ModelCardBody({ model }: { model: ModelView }) {
  const artifacts = Object.entries(model.artifacts);

  return (
    <>
      <section aria-labelledby="identity-heading" className="space-y-4">
        <SectionHeader
          id="identity-heading"
          title="Identity"
          description="What is loaded and running right now, as the service reports it."
          aside={<StatusLabel provenance="verified" />}
        />
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'Model', value: model.name },
            { label: 'Version', value: model.version, note: 'first 12 characters of the file hash' },
            { label: 'Features expected', value: String(model.feature_count) },
            {
              label: 'Training datasets',
              value: model.datasets.length > 0 ? model.datasets.join(', ') : 'not reported',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface p-3">
              <dt className="text-sm text-ink-muted">{item.label}</dt>
              <dd className="mt-0.5 font-mono text-base break-words text-ink">{item.value}</dd>
              {item.note !== undefined && (
                <p className="mt-0.5 text-xs text-ink-subtle">{item.note}</p>
              )}
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="use-heading" className="space-y-4">
        <SectionHeader
          id="use-heading"
          title="Intended use"
          description="Written by this project, not by the service. It is a statement of scope, and the boundary is the important half."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="What it is for"
              aside={<Target aria-hidden className="size-5 text-accent" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>Deciding whether a person should be offered the two laboratory tests.</li>
              <li>Prompting a conversation with a clinician that would not otherwise happen.</li>
              <li>Teaching how a screening model reaches a conclusion, driver by driver.</li>
              <li>Research use on records that are already de-identified.</li>
            </ul>
          </Card>
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="What it must not decide"
              aside={<Ban aria-hidden className="size-5 text-danger" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>Whether a person has chronic kidney disease. It cannot establish that.</li>
              <li>A stage, a severity, or a rate of progression. It measures none of them.</li>
              <li>Any medication, dose, or referral decision.</li>
              <li>
                Whether to skip a test. A lower band is not a reason to cancel a creatinine
                measurement a clinician wanted.
              </li>
            </ul>
          </Card>
        </div>
      </section>

      <section aria-labelledby="data-heading" className="space-y-4">
        <SectionHeader
          id="data-heading"
          title="Training data"
          description="Sizes as reported by the service. Where it reports nothing, nothing is shown."
          aside={<StatusLabel provenance="verified" />}
        />
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Records in total', value: model.n_rows },
            { label: 'Used for training', value: model.n_train },
            { label: 'Held back for testing', value: model.n_test },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface p-3">
              <dt className="text-sm text-ink-muted">{item.label}</dt>
              <dd className="mt-0.5 font-mono text-2xl tabular-nums text-ink">
                {item.value === null ? '—' : item.value}
              </dd>
            </div>
          ))}
        </dl>
        <Alert tone="warn" title="One dataset, four hundred records">
          Every number in the next section was measured on the held-back portion of a single
          public dataset. It describes this model on that data. It does not establish how the
          model behaves on Ethiopian clinical records, which are not in it, and no figure here
          should be quoted as clinical performance.
        </Alert>
      </section>

      <section aria-labelledby="metrics-heading" className="space-y-4">
        <SectionHeader
          id="metrics-heading"
          title="Measured performance"
          description="Read from the service's evaluation block and shown to three decimal places, exactly as reported."
          aside={<StatusLabel provenance="provisional" />}
        />
        <MetricsTable metrics={model.metrics} />
        {model.metrics.confusion_matrix !== undefined && (
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="Where the test predictions landed"
              description="The service's confusion matrix, with each cell named."
              aside={<Ruler aria-hidden className="size-5 text-ink-subtle" />}
            />
            <ConfusionMatrix matrix={model.metrics.confusion_matrix} />
          </Card>
        )}
      </section>

      <section aria-labelledby="limits-heading" className="space-y-4">
        <SectionHeader
          id="limits-heading"
          title="Limitations stated by the service"
          description="Returned by the API and rendered word for word. This project does not edit, soften, or reorder them."
          aside={<StatusLabel provenance="verified" />}
        />
        {model.limitations.length === 0 ? (
          <p className="text-sm text-ink-muted">The service returned no limitations.</p>
        ) : (
          <ul className="space-y-2">
            {model.limitations.map((limitation) => (
              <li key={limitation}>
                <Alert tone="warn">{limitation}</Alert>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="artifacts-heading" className="space-y-4">
        <SectionHeader
          id="artifacts-heading"
          title="Artefact integrity"
          description="Each file is identified by the hash of its contents, so a result can be tied to an exact artefact."
          aside={<StatusLabel provenance="verified" />}
        />
        <DataTable
          caption="Loaded artefacts and their content hashes"
          columns={[
            { key: 'name', header: 'Artefact', cell: (row: [string, { sha256: string }]) => row[0] },
            {
              key: 'sha256',
              header: 'sha256',
              cell: (row: [string, { sha256: string }]) => (
                <span className="font-mono text-xs break-all">{row[1].sha256}</span>
              ),
            },
          ]}
          rows={artifacts}
          rowKey={(row) => row[0]}
          empty={<p className="text-sm text-ink-muted">The service reported no artefacts.</p>}
        />
        <p className="max-w-(--container-prose) text-sm text-ink-muted">
          File locations are deliberately absent. The API includes an absolute server path
          alongside each hash; the frontend drops it while parsing the response, so no page can
          display it and no screenshot can leak it.
        </p>
      </section>
    </>
  );
}

export default function ModelCardRoute() {
  const model = useModelMetadata();

  return (
    <RouteShell
      title="Model card"
      description="What the deployed model is, how it was evaluated, and what it must not be used for. The factual parts are read from the service; the scope statement is this project's own."
    >
      {model.isPending && <SkeletonText lines={6} />}

      {model.isError && (
        <ErrorState
          error={model.error}
          onRetry={() => void model.refetch()}
          retryLabel="Try again"
        >
          Without this document the page has nothing to describe. It shows no cached copy and no
          example values, because a model card that might be describing a different model is
          worse than an empty one.
        </ErrorState>
      )}

      {model.isSuccess && <ModelCardBody model={model.data} />}

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link to="/assessment" className={buttonClasses('primary', 'md')}>
          <ClipboardList aria-hidden className="size-4" />
          Start an assessment
        </Link>
        <Link to="/research" className={buttonClasses('secondary', 'md')}>
          <FlaskConical aria-hidden className="size-4" />
          Research Lab
        </Link>
        <Link to="/about" className={buttonClasses('ghost', 'md')}>
          <ShieldAlert aria-hidden className="size-4" />
          Scope and data handling
        </Link>
      </div>
    </RouteShell>
  );
}

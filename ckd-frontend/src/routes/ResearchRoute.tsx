import { Outlet, useLocation, Link } from 'react-router-dom';
import {
  Braces,
  FileSpreadsheet,
  GitCompare,
  Hash,
  ListOrdered,
  Network,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLabel } from '../components/provenance/StatusLabel';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SkeletonText } from '../components/ui/Skeleton';
import { buttonClasses } from '../components/ui/styles';
import { useModelMetadata } from '../lib/query/hooks';
import type { ModelView } from '../types/api.types';

/**
 * `/research` — the research area's index.
 *
 * Rendered as a layout with an `<Outlet />` so `/research/batch` nests beneath it in
 * the URL without inheriting this page's heading. The index content shows only when
 * the path is exactly `/research`; a nested route replaces it entirely, which keeps
 * one `<h1>` per page.
 *
 * This page deliberately does not restate the model card. Its job is what a
 * researcher cannot get anywhere else in the product: the exact field contract in
 * model order, the artefact hashes a result can be pinned to, the working bulk
 * scoring tool, and a straight answer about the four things the service does not
 * expose. The split between those two halves is the sharpest example of the honesty
 * rule — `/model` really does return datasets and an evaluation block, so those carry
 * VERIFIED; comparison, threshold sweeps, and federated rounds have no endpoint at
 * all, so they are named as absent rather than filled with plausible figures.
 */

interface Gap {
  title: string;
  icon: typeof GitCompare;
  provenance: 'not-verified' | 'planned';
  detail: string;
  dependency: string;
}

const GAPS: readonly Gap[] = [
  {
    title: 'Model comparison',
    icon: GitCompare,
    provenance: 'not-verified',
    detail:
      'Comparing candidates needs a response describing more than one model. `GET /model` describes exactly the one that is loaded, so there is no second column to put beside it.',
    dependency: 'An endpoint returning per-candidate metrics.',
  },
  {
    title: 'Threshold analysis',
    icon: SlidersHorizontal,
    provenance: 'not-verified',
    detail:
      'A threshold sweep exists in the training code, but no route reaches it. Drawing the curve from the frontend would mean re-scoring the test set in a browser that has never seen it.',
    dependency: 'An endpoint returning the sweep the trainer already computes.',
  },
  {
    title: 'Federated rounds',
    icon: Network,
    provenance: 'not-verified',
    detail:
      'No round, no per-site metric, no aggregation result is exposed. The federated page explains the method and reports no figures, which is the only honest option available to it.',
    dependency: 'An endpoint returning round history and per-site counts.',
  },
  {
    title: 'Training date',
    icon: Hash,
    provenance: 'planned',
    detail:
      'The model document carries no timestamp, so "when was this trained" has no answer here. The artefact hash identifies *which* model, never *when*.',
    dependency: 'A trained-at field on the model document.',
  },
];

/** Four figures, chosen because they are the ones a reviewer asks for first. */
function HeadlineMetrics({ model }: { model: ModelView }) {
  const cells = [
    { label: 'Accuracy', value: model.metrics.accuracy },
    { label: 'Recall', value: model.metrics.recall },
    { label: 'Specificity', value: model.metrics.specificity },
    { label: 'AUC-ROC', value: model.metrics.auc_roc },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-lg border border-border bg-surface p-3">
          <dt className="text-sm text-ink-muted">{cell.label}</dt>
          <dd className="mt-0.5 font-mono text-2xl tabular-nums text-ink">
            {cell.value === undefined ? '—' : cell.value.toFixed(3)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ResearchBody({ model }: { model: ModelView }) {
  const schema = model.feature_schema;
  const artifacts = Object.entries(model.artifacts);

  return (
    <>
      <section aria-labelledby="tools-heading" className="space-y-4">
        <SectionHeader
          id="tools-heading"
          title="Working tools"
          description="Two ways to put records through the deployed model without going through the guided assessment."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg" as="article" className="flex flex-col">
            <CardHeader
              level={3}
              title="Bulk scoring"
              description="Score many records at once from a CSV file or a JSON array, with optional per-row drivers."
              aside={<FileSpreadsheet aria-hidden className="size-5 text-accent" />}
            />
            <p className="mb-4 grow text-sm text-ink-muted">
              Runs against the same model and the same field contract as a single assessment.
              Results are shown in the browser and are never written to disk by this application.
            </p>
            <Link to="/research/batch" className={buttonClasses('primary', 'md', 'self-start')}>
              Open bulk scoring
            </Link>
          </Card>
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="The API directly"
              description="Four endpoints, no authentication in local development."
              aside={<Terminal aria-hidden className="size-5 text-ink-subtle" />}
            />
            <div
              role="region"
              tabIndex={0}
              aria-label="Example requests against the prediction service"
              className="overflow-x-auto rounded-md border border-border bg-surface-sunken p-3"
            >
              {/*
                No origin is written here on purpose (ADR-9). This application never
                names a host — the browser calls `/api/*` on its own origin and the
                dev server forwards it — so an examples block that hard-coded one
                machine's address would be wrong for every other reader.
              */}
              <pre className="font-mono text-xs leading-relaxed text-ink">
{`BASE=… # wherever the service is served

curl "$BASE/health"
curl "$BASE/model"
curl "$BASE/openapi.json"

curl -X POST "$BASE/predict" \\
  -H 'content-type: application/json' \\
  -d '{"age":60,"sc":3.1,"hemo":9.4,"htn":"yes"}'`}
              </pre>
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              Every field is optional; whatever is omitted is imputed by the service and reported
              back in <code className="font-mono text-xs">imputed_fields</code>. In the browser this
              application reaches the same endpoints under{' '}
              <code className="font-mono text-xs">/api</code> on its own origin, so it works
              wherever it is deployed.
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="evaluation-heading" className="space-y-4">
        <SectionHeader
          id="evaluation-heading"
          title="Evaluation, at a glance"
          description="Read from the service's own evaluation block. The model card holds the full table, the reported intervals, and the labelled confusion matrix."
          aside={<StatusLabel provenance="provisional" />}
          actions={
            <Link to="/model-card" className={buttonClasses('secondary', 'sm')}>
              Full model card
            </Link>
          }
        />
        <HeadlineMetrics model={model} />
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Datasets', value: model.datasets.length > 0 ? model.datasets.join(', ') : '—' },
            { label: 'Rows', value: model.n_rows === null ? '—' : String(model.n_rows) },
            { label: 'Train', value: model.n_train === null ? '—' : String(model.n_train) },
            { label: 'Test', value: model.n_test === null ? '—' : String(model.n_test) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface-sunken p-3">
              <dt className="text-sm text-ink-muted">{item.label}</dt>
              <dd className="mt-0.5 font-mono text-base break-words text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
        <Alert tone="warn" title="Read these as a characterisation of the model, not of the disease">
          The test split is small and comes from one public dataset. Differences of a few
          thousandths between any two of these figures are not measurable at this sample size, and
          none of them was measured on Ethiopian clinical records.
        </Alert>
      </section>

      <section aria-labelledby="contract-heading" className="space-y-4">
        <SectionHeader
          id="contract-heading"
          title="The field contract"
          description="The features the loaded model expects, in the order it expects them. Read from the service at page load — this list is not maintained in frontend source."
          aside={<StatusLabel provenance="verified" />}
        />
        <Card padding="lg">
          <CardHeader
            level={3}
            title={`${String(model.feature_count)} features, in model order`}
            description="Position matters: the preprocessor consumes this order, so a renamed or reordered field is a contract change."
            aside={<ListOrdered aria-hidden className="size-5 text-ink-subtle" />}
          />
          <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {schema.map((field, index) => (
              <li
                key={field}
                className="flex items-baseline gap-2 rounded-md border border-border bg-surface-sunken px-2.5 py-1.5"
              >
                <span className="font-mono text-xs text-ink-subtle tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-sm text-ink">{field}</span>
              </li>
            ))}
          </ol>
          {schema.length !== model.feature_count && (
            <Alert tone="danger" title="The document disagrees with itself" className="mt-4">
              The service reported {model.feature_count} expected features but listed{' '}
              {schema.length}. Nothing has been reconciled here; the two values are shown as
              received.
            </Alert>
          )}
        </Card>
        <p className="max-w-(--container-prose) text-sm text-ink-muted">
          Value ranges and permitted categories are not listed here either. The assessment form
          reads them from <code className="font-mono text-xs">/openapi.json</code>, which FastAPI
          generates from the same Pydantic model the endpoint validates against, so the form and
          the service cannot drift apart.
        </p>
      </section>

      <section aria-labelledby="repro-heading" className="space-y-4">
        <SectionHeader
          id="repro-heading"
          title="Pinning a result to an artefact"
          description="Quote these hashes in a write-up and a reader can tell whether a later result came from the same files."
          aside={<StatusLabel provenance="verified" />}
        />
        <DataTable
          caption="Loaded artefacts and their content hashes"
          columns={[
            {
              key: 'name',
              header: 'Artefact',
              cell: (row: [string, { sha256: string }]) => (
                <span className="font-mono text-sm">{row[0]}</span>
              ),
            },
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
          The displayed model version — <code className="font-mono text-xs">{model.version}</code>{' '}
          — is the first twelve characters of the model artefact's hash. File locations are dropped
          while the response is parsed and appear on no page.
        </p>
      </section>

      <section aria-labelledby="gaps-heading" className="space-y-4">
        <SectionHeader
          id="gaps-heading"
          title="What this service does not expose"
          description="Named individually, with the dependency each one waits on. A research page that quietly omitted these would read as though they had been considered and rejected."
        />
        <ul className="grid gap-3 sm:grid-cols-2">
          {GAPS.map((gap) => {
            const Icon = gap.icon;
            return (
              <li key={gap.title}>
                <Card padding="md" as="article" className="h-full">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                      <Icon aria-hidden className="size-4 text-ink-subtle" />
                      {gap.title}
                    </h3>
                    <StatusLabel provenance={gap.provenance} />
                  </div>
                  <p className="text-sm text-ink-muted">{gap.detail}</p>
                  <p className="mt-2 flex items-start gap-2 text-sm text-ink-subtle">
                    <Braces aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-medium text-ink-muted">Needs: </span>
                      {gap.dependency}
                    </span>
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

export default function ResearchRoute() {
  const { pathname } = useLocation();
  const model = useModelMetadata();

  if (pathname !== '/research') return <Outlet />;

  return (
    <RouteShell
      title="Research Lab"
      description="The field contract, the artefact hashes, the evaluation figures the service reports, and a bulk scoring tool. Everything factual here is read from the API at page load."
    >
      {model.isPending && <SkeletonText lines={6} />}

      {model.isError && (
        <ErrorState error={model.error} onRetry={() => void model.refetch()}>
          The tools below all describe the deployed model, so without its document there is
          nothing to describe. No cached or example figures are shown in its place.
        </ErrorState>
      )}

      {model.isSuccess && <ResearchBody model={model.data} />}
    </RouteShell>
  );
}

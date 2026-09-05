import { Link } from 'react-router-dom';
import { ChartColumn, ClipboardList } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses } from '../components/ui/styles';
import { DriverList } from '../features/explainability/DriverList';
import { orderDrivers } from '../features/explainability/drivers';
import { fieldCopy } from '../content/fields';
import { usePrediction } from '../lib/state/prediction-context';
import type { ShapDriver } from '../types/api.types';

/**
 * `/explainability`.
 *
 * The page answers one question — *why did the model say that?* — and it is bound to
 * a specific result. Without a prediction there is nothing honest to explain, and an
 * example chart built from invented drivers would be the most misleading thing on the
 * site, so the empty state is the whole page.
 *
 * Chart and table, always both (R4.6). The bars in `DriverList` carry shape and rank;
 * the table carries the exact signed SHAP values. A bar chart alone is unreadable
 * with a screen reader and cramped at 320 px, and a table alone loses the comparison
 * at a glance — neither is a substitute for the other, so both are always rendered.
 *
 * The prose is blunt about two limits the method has, because a page called
 * "explainability" invites more trust than the numbers deserve: a driver is a
 * statistical attribution and not a cause, and the service returns only its top few
 * rather than all 24 contributions.
 */
export default function ExplainabilityRoute() {
  const { prediction, assessment } = usePrediction();

  if (prediction === null) {
    return (
      <RouteShell
        title="What influenced your result"
        documentTitle="Explainability"
        description="The model reports which of your values pushed its estimate up or down. That is a description of the model’s reasoning, not a statement about your body."
      >
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
      </RouteShell>
    );
  }

  const ordered = orderDrivers(prediction.shap_drivers);
  const totalFields = prediction.model.feature_count;
  const imputed = new Set(prediction.imputed_fields);

  const columns: readonly Column<ShapDriver>[] = [
    {
      key: 'rank',
      header: '#',
      headerLabel: 'Rank by impact',
      cell: (driver) => ordered.indexOf(driver) + 1,
      numeric: true,
    },
    {
      key: 'feature',
      header: 'Measurement',
      cell: (driver) => (
        <>
          <span className="font-medium">{fieldCopy(driver.feature)?.label ?? driver.feature}</span>
          <span className="block text-xs text-ink-subtle">
            {fieldCopy(driver.feature)?.clinicalName ?? driver.feature}
          </span>
        </>
      ),
    },
    {
      key: 'value',
      header: 'Your value',
      cell: (driver) => {
        const raw = (assessment as unknown as Record<string, unknown> | null)?.[driver.feature];
        if (raw === null || raw === undefined || raw === '') {
          return <span className="text-ink-subtle italic">estimated</span>;
        }
        const unit = fieldCopy(driver.feature)?.unit ?? '';
        return `${String(raw)}${unit === '' ? '' : ` ${unit}`}`;
      },
    },
    {
      key: 'shap',
      header: 'SHAP value',
      headerLabel: 'SHAP value, signed',
      cell: (driver) => driver.value.toFixed(4),
      numeric: true,
    },
    {
      key: 'direction',
      header: 'Effect on the score',
      cell: (driver) =>
        driver.direction === 'raises_risk'
          ? 'Raised it'
          : driver.direction === 'lowers_risk'
            ? 'Lowered it'
            : 'Little effect',
    },
    {
      key: 'source',
      header: 'Came from',
      cell: (driver) => (imputed.has(driver.feature) ? 'The model’s estimate' : 'You'),
    },
  ];

  return (
    <RouteShell
      title="What influenced your result"
      documentTitle="Explainability"
      description="The model reports which of your values pushed its estimate up or down. That is a description of the model’s reasoning, not a statement about your body."
    >
      <Alert tone="info" title="Read this as the model’s reasoning, not a cause">
        A driver is the model’s own accounting of which inputs moved its number, learned
        from patterns in its training data. “Haemoglobin raised the score” means records
        with a similar haemoglobin value were more often labelled CKD in that data — not
        that haemoglobin caused kidney disease, and not that changing it would change your
        health. Causation needs a clinician and a proper test.
      </Alert>

      <section aria-labelledby="drivers-heading" className="space-y-4">
        <SectionHeader
          id="drivers-heading"
          title="Your drivers, strongest first"
          description={
            ordered.length === 0
              ? 'The service returned no drivers for this result.'
              : `The service returned ${ordered.length} of the ${totalFields} measurements it considered. Bar length compares them to each other — it is not a percentage, and a SHAP value has no fixed maximum.`
          }
        />
        {ordered.length === 0 ? (
          <EmptyState
            title="No drivers were returned"
            description="The result stands, but the service sent no attribution for it. Nothing is being shown in place of one."
          />
        ) : (
          <DriverList
            drivers={prediction.shap_drivers}
            assessment={assessment}
            imputedFields={prediction.imputed_fields}
          />
        )}
      </section>

      {ordered.length > 0 && (
        <section aria-labelledby="table-heading" className="space-y-4">
          <SectionHeader
            id="table-heading"
            level={2}
            title="The same drivers, exactly"
            description="The signed values behind the bars above, for anyone who wants the figures rather than the shape."
          />
          <DataTable
            caption="SHAP drivers for this result, ordered by absolute impact"
            hideCaption
            columns={columns}
            rows={ordered}
            rowKey={(driver) => driver.feature}
          />
        </section>
      )}

      <Card padding="lg" as="section" aria-labelledby="shap-heading">
        <CardHeader
          level={2}
          title={<span id="shap-heading">What SHAP is, in plain words</span>}
          description="The method behind the numbers above."
        />
        <div className="space-y-3 text-sm text-ink">
          <p>
            The model is not a formula anyone can read off. SHAP — SHapley Additive
            exPlanations — works out how much each of your values contributed to the score
            by asking what the model would have said without it, across many combinations,
            and averaging the difference. The result is one signed number per measurement:
            positive and negative pull the score in opposite directions, and the size says
            how hard.
          </p>
          <p>
            <strong className="font-semibold">Three limits worth knowing.</strong> The
            service returns its strongest few drivers, not all {totalFields} — so a
            measurement missing from this list contributed something, just less than the
            ones shown. Attributions are specific to this one record; the same value in a
            different combination can pull the other way. And a value the model estimated
            for you still gets a driver, which is why the table names where each one came
            from.
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link to="/results" className={buttonClasses('secondary', 'md')}>
          <ClipboardList aria-hidden className="size-4" />
          Back to your result
        </Link>
        <Link to="/learn" className={buttonClasses('ghost', 'md')}>
          Learn what these measurements mean
        </Link>
      </div>
    </RouteShell>
  );
}

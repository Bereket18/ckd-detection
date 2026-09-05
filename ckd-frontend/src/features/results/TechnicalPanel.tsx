/**
 * The result, for someone reading the model.
 *
 * The technical half of the Results split. Everything here is a number the service
 * returned or a statement about how it was produced — no interpretation, no advice,
 * and nothing computed locally from the response. Three rules govern it:
 *
 * - **`risk_band` is displayed, never derived.** The bounds that produce it are not
 *   in the contract, so recomputing would mean inventing them.
 * - **`ckd_score` is shown at full precision and never as a percentage.** It is a
 *   raw positive-class score; the service says itself that it is not calibrated.
 * - **`model.artifacts[*].path` does not exist by the time this renders.** The
 *   projection layer removed it; the hash is the version handle (§8.3).
 */

import { Link } from 'react-router-dom';
import { ChartColumn, FileText } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Card, CardHeader } from '../../components/ui/Card';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { buttonClasses } from '../../components/ui/styles';
import { StatusLabel } from '../../components/provenance/StatusLabel';
import { DriverList } from '../explainability/DriverList';
import type { PatientAssessment, PredictionView } from '../../types/api.types';

interface TechnicalPanelProps {
  prediction: PredictionView;
  assessment: PatientAssessment | null;
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right">
        <span className="font-mono text-sm text-ink tabular-nums">{value}</span>
        {note !== undefined && <span className="ms-2 text-xs text-ink-subtle">{note}</span>}
      </dd>
    </div>
  );
}

export function TechnicalPanel({ prediction, assessment }: TechnicalPanelProps) {
  const driverCount = prediction.shap_drivers.length;
  const provided = prediction.model.feature_count - prediction.imputation_count;

  return (
    <section aria-labelledby="technical-heading" className="space-y-6">
      <SectionHeader
        id="technical-heading"
        title="The response, as returned"
        description="Every value below came from the service in this session. Nothing on this page is recomputed, rescaled, or rounded up."
        aside={<StatusLabel provenance="verified" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg" as="article">
          <CardHeader
            level={3}
            title="Classification"
            description="The two fields that carry the outcome, plus the score behind them."
          />
          <dl>
            <Row
              label="prediction"
              value={prediction.prediction}
              note={prediction.prediction === 'ckd' ? 'positive class' : 'negative class'}
            />
            <Row label="risk_band" value={prediction.risk_band} note="supplied, not derived" />
            <Row
              label="ckd_score"
              value={prediction.ckd_score.toFixed(6)}
              note="0–1, uncalibrated"
            />
          </dl>
          <p className="mt-3 text-sm text-ink-muted">
            The band comes from thresholds the API does not publish, so this page shows the
            band it was given and never reconstructs it from the score.
          </p>
        </Card>

        <Card padding="lg" as="article">
          <CardHeader
            level={3}
            title="Input completeness"
            description="How much of the feature vector came from the person and how much from the imputer."
          />
          <dl>
            <Row label="feature_count" value={String(prediction.model.feature_count)} />
            <Row label="values provided" value={String(provided)} />
            <Row label="imputation_count" value={String(prediction.imputation_count)} />
          </dl>
          {prediction.imputed_fields.length > 0 && (
            <p className="mt-3 font-mono text-xs break-words text-ink-subtle">
              imputed_fields: {prediction.imputed_fields.join(', ')}
            </p>
          )}
        </Card>
      </div>

      <section aria-labelledby="technical-drivers-heading" className="space-y-3">
        <SectionHeader
          level={3}
          id="technical-drivers-heading"
          title="SHAP contributions"
          description={
            driverCount === 0
              ? 'The service returned no drivers for this record.'
              : `${driverCount} signed contributions, ordered by absolute magnitude. The service decides how many it returns; there is no parameter to request more.`
          }
          actions={
            driverCount === 0 ? undefined : (
              <Link to="/explainability" className={buttonClasses('secondary', 'sm')}>
                <ChartColumn aria-hidden className="size-4" />
                Full table
              </Link>
            )
          }
        />
        {driverCount > 0 && (
          <DriverList
            drivers={prediction.shap_drivers}
            assessment={assessment}
            imputedFields={prediction.imputed_fields}
            showValues
          />
        )}
      </section>

      <Card padding="lg" as="article">
        <CardHeader
          level={3}
          title="Artefact identity"
          description="Models are identified by content hash. File locations are removed before this page receives the response and are never displayed."
        />
        <dl>
          <Row label="model.name" value={prediction.model.name} />
          <Row label="model.version" value={prediction.model.version} note="sha256, first 12" />
          {Object.entries(prediction.model.artifacts).map(([name, artifact]) => (
            <Row key={name} label={`artifacts.${name}.sha256`} value={artifact.sha256} />
          ))}
        </dl>
      </Card>

      <Alert tone="info" title="What this model was trained on">
        <p>
          {prediction.model.n_rows === null
            ? 'The service does not report a dataset size.'
            : `${prediction.model.n_rows} records`}
          {prediction.model.n_train !== null &&
            prediction.model.n_test !== null &&
            `, split ${prediction.model.n_train} train / ${prediction.model.n_test} test`}
          {prediction.model.datasets.length > 0 && `, from ${prediction.model.datasets.join(', ')}`}
          . Measured performance and the limitations the service states are on the model card.
        </p>
        <p className="mt-2">
          <Link to="/model-card" className="font-medium text-accent-ink underline">
            <FileText aria-hidden className="me-1 inline size-4 align-text-bottom" />
            Read the model card
          </Link>
        </p>
      </Alert>
    </section>
  );
}

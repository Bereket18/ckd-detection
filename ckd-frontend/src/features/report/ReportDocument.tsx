import type { ReactNode } from 'react';
import { fieldCopy } from '../../content/fields';
import { orderDrivers } from '../explainability/drivers';
import type { PatientAssessment, PredictionView } from '../../types/api.types';

/**
 * The printable screening report.
 *
 * There is no report endpoint on the backend, so this document is generated in the
 * browser from the response the user is already holding — which means no server ever
 * stores a copy, and the report cannot contain anything the user has not already
 * seen. `window.print()` turns it into a PDF through the browser's own dialogue.
 *
 * It is deliberately plain: ruled boxes, no filled panels, no chart. A printer turns
 * a coloured risk panel into grey wash, and a bar chart into an unlabelled smear —
 * both fail on paper in ways they do not on screen. Every fact here carries its own
 * word, so nothing depends on colour surviving the print pipeline.
 *
 * What the document must never become is a clinical record. Two things keep it from
 * reading as one: the header states what kind of document it is before anything else,
 * and there is no patient identifier anywhere in it — no name field, no ID, no date
 * of birth. The application never collected one, and a report with a blank name line
 * invites someone to write one in and file it.
 */

const BAND_WORD: Record<PredictionView['risk_band'], string> = {
  LOW: 'Lower risk indicated',
  MODERATE: 'Moderate risk indicated',
  HIGH: 'Higher risk indicated',
};

const DIRECTION_WORD: Record<'raises_risk' | 'lowers_risk' | 'neutral', string> = {
  raises_risk: 'Raised the score',
  lowers_risk: 'Lowered the score',
  neutral: 'Little effect',
};

/** Section frame. `print-keep` asks the printer not to split it across a page. */
function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="print-keep space-y-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-ink">
        <span className="me-2 font-mono text-ink-subtle">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A label/value row. Used instead of a table where there are only two columns. */
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 gap-y-0.5 border-b border-border py-1.5 last:border-b-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

const TH = 'border border-border px-2 py-1.5 text-left font-semibold text-ink';
const TD = 'border border-border px-2 py-1.5 align-top text-ink';

export function ReportDocument({
  prediction,
  assessment,
  generatedAt,
}: {
  prediction: PredictionView;
  assessment: PatientAssessment | null;
  /**
   * When the result was received, or `null` if that is not known — in which case no
   * time is printed rather than the time this document happened to render, which
   * would be a different and misleading claim.
   */
  generatedAt: number | null;
}) {
  const model = prediction.model;
  const answers = assessment as unknown as Record<string, unknown> | null;
  const imputed = new Set(prediction.imputed_fields);
  const drivers = orderDrivers(prediction.shap_drivers);
  const stamp = generatedAt === null ? null : new Date(generatedAt);
  const answeredCount = model.feature_count - prediction.imputation_count;
  // Section numbers are consecutive, so the optional explanation section shifts the
  // two after it. Derived from the same predicate that decides whether to render it,
  // so the numbering cannot disagree with what is on the page.
  const hasExplanation =
    prediction.explanation !== null && prediction.explanation.trim() !== '';

  const submitted = (name: string): string | null => {
    const raw = answers?.[name];
    if (raw === null || raw === undefined || raw === '') return null;
    return String(raw);
  };

  return (
    <article className="mx-auto max-w-(--container-prose) space-y-5 bg-surface p-6 text-ink sm:p-8 print:max-w-none print:p-0">
      <header className="space-y-3 border-b-2 border-ink pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-lg font-semibold tracking-tight">EthioCKD</p>
          <p className="font-mono text-xs text-ink-muted">
            {stamp === null ? null : `${stamp.toLocaleDateString()} ${stamp.toLocaleTimeString()}`}
          </p>
        </div>
        <h1 className="text-2xl font-semibold">Chronic kidney disease screening report</h1>
        <p className="text-sm text-ink-muted">
          A record of one screening run by a machine-learning model. It is{' '}
          <strong className="font-semibold text-ink">not a diagnosis</strong>, not a
          laboratory result, and not a clinical record. It carries no patient identifier
          because none was collected. Its purpose is to be taken to a clinician alongside
          the measurements it was built from.
        </p>
      </header>

      <Section n={1} title="Result">
        <dl>
          <Row label="Risk band returned" value={`${prediction.risk_band} — ${BAND_WORD[prediction.risk_band]}`} />
          <Row
            label="Model score"
            value={
              <>
                <span className="font-mono">{prediction.ckd_score.toFixed(4)}</span> on a 0–1
                scale
              </>
            }
          />
          <Row
            label="Model classification"
            value={prediction.prediction === 'ckd' ? 'CKD' : 'Not CKD'}
          />
        </dl>
        <p className="text-sm text-ink-muted">
          The score is the model’s raw output for the positive class. The service states
          that it is not a calibrated probability, so it must not be read as a percentage
          chance of disease. The risk band is the service’s own interpretation of that
          score and was not recalculated when this report was produced.
        </p>
      </Section>

      <Section n={2} title="Completeness of the input">
        <dl>
          <Row label="Measurements the model expects" value={model.feature_count} />
          <Row label="Provided by the person screened" value={answeredCount} />
          <Row label="Estimated by the model" value={prediction.imputation_count} />
        </dl>
        {prediction.imputation_count > 0 && (
          <p className="text-sm text-ink-muted">
            Estimated values were substituted from the model’s training data, not measured.
            Each one makes this result less specific to the person screened. They are marked
            in section 3.
          </p>
        )}
      </Section>

      <Section n={3} title="Values used">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Every measurement the model expects, its submitted value, and whether it was
            provided or estimated
          </caption>
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Measurement
              </th>
              <th scope="col" className={TH}>
                Value
              </th>
              <th scope="col" className={TH}>
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            {model.feature_schema.map((name) => {
              const copy = fieldCopy(name);
              const value = submitted(name);
              return (
                <tr key={name}>
                  <td className={TD}>
                    {copy?.label ?? name}
                    <span className="block font-mono text-xs text-ink-subtle">{name}</span>
                  </td>
                  <td className={TD}>
                    {value === null ? (
                      <span className="text-ink-subtle">—</span>
                    ) : (
                      <>
                        <span className="font-mono">{value}</span>
                        {copy?.unit ? ` ${copy.unit}` : ''}
                      </>
                    )}
                  </td>
                  <td className={TD}>
                    {imputed.has(name) ? 'Estimated by the model' : 'Provided'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section n={4} title="What influenced the score most">
        {drivers.length === 0 ? (
          <p className="text-sm text-ink-muted">
            The service returned no attribution for this result.
          </p>
        ) : (
          <>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                SHAP drivers for this result, ordered by absolute impact
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    #
                  </th>
                  <th scope="col" className={TH}>
                    Measurement
                  </th>
                  <th scope="col" className={TH}>
                    Value
                  </th>
                  <th scope="col" className={TH}>
                    SHAP
                  </th>
                  <th scope="col" className={TH}>
                    Effect
                  </th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver, index) => (
                  <tr key={driver.feature}>
                    <td className={TD}>{index + 1}</td>
                    <td className={TD}>{fieldCopy(driver.feature)?.label ?? driver.feature}</td>
                    <td className={TD}>
                      {submitted(driver.feature) ?? <span className="text-ink-subtle">estimated</span>}
                    </td>
                    <td className={`${TD} font-mono`}>{driver.value.toFixed(4)}</td>
                    <td className={TD}>{DIRECTION_WORD[driver.direction]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm text-ink-muted">
              Attributions are produced by SHAP and describe how the model reached this
              score. They are statistical, specific to this one record, and are not
              statements of cause. The service returns its strongest {drivers.length}, not
              all {model.feature_count}.
            </p>
          </>
        )}
      </Section>

      {hasExplanation && (
        <Section n={5} title="The service’s explanation">
          <p className="text-sm whitespace-pre-line text-ink">{prediction.explanation}</p>
        </Section>
      )}

      <Section n={hasExplanation ? 6 : 5} title="Model provenance">
        <dl>
          <Row label="Model" value={model.name} />
          <Row label="Version (sha256, first 12)" value={<span className="font-mono">{model.version}</span>} />
          <Row label="Training data" value={model.datasets.length > 0 ? model.datasets.join(', ') : 'Not reported'} />
          <Row label="Records" value={model.n_rows ?? 'Not reported'} />
          <Row
            label="Train / test split"
            value={
              model.n_train === null || model.n_test === null
                ? 'Not reported'
                : `${model.n_train} / ${model.n_test}`
            }
          />
          {model.metrics.accuracy !== undefined && (
            <Row label="Accuracy (held-out test set)" value={model.metrics.accuracy.toFixed(3)} />
          )}
          {model.metrics.recall !== undefined && (
            <Row label="Recall / sensitivity" value={model.metrics.recall.toFixed(3)} />
          )}
          {model.metrics.specificity !== undefined && (
            <Row label="Specificity" value={model.metrics.specificity.toFixed(3)} />
          )}
          {model.metrics.auc_roc !== undefined && (
            <Row label="AUC-ROC" value={model.metrics.auc_roc.toFixed(3)} />
          )}
        </dl>
        <p className="text-sm text-ink-muted">
          These figures were measured on the model’s own held-out test set. They describe
          performance on data resembling that set and are not a guarantee for any
          individual.
        </p>
      </Section>

      {model.limitations.length > 0 && (
        <Section n={hasExplanation ? 7 : 6} title="Limitations stated by the service">
          <ul className="list-disc space-y-1 ps-5 text-sm text-ink">
            {model.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </Section>
      )}

      <section className="print-keep space-y-2 border-2 border-ink p-4">
        <h2 className="text-base font-semibold">Disclaimer</h2>
        <p className="text-sm">{prediction.disclaimer}</p>
      </section>

      <footer className="border-t border-border pt-4 text-xs text-ink-muted">
        <p>
          Generated in the browser from a single screening response. No copy of this report
          and no answer it contains was sent to or stored on any server. Model{' '}
          {model.name} version {model.version}. EthioCKD is a screening aid for research
          and education.
        </p>
      </footer>
    </article>
  );
}

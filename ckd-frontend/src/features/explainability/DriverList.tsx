import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { TONE_ICON, type StatusTone } from '../../components/ui/styles';
import { fieldCopy } from '../../content/fields';
import type { PatientAssessment, ShapDriver } from '../../types/api.types';
import { orderDrivers } from './drivers';

/**
 * The SHAP drivers, ordered and directed by the backend.
 *
 * Two rules govern this file, and both are about not inventing meaning:
 *
 * - **`direction` is rendered, never re-derived.** The sign convention of a SHAP
 *   value depends on which class the explainer was built against, and the backend
 *   already states its reading in the `direction` field. Deciding "negative means
 *   lower risk" here would invert every arrow the day that convention changes.
 * - **Bar lengths are relative to the largest driver in this response**, not to any
 *   absolute scale. A SHAP value has no natural maximum, so the bars answer "which
 *   of these mattered most" and the caption says so. They are not percentages.
 *
 * The patient's own value sits beside each driver because a driver without one is
 * unusable: "haemoglobin raised your risk" invites the question "what was it?", and
 * the response does not carry the answer — the submitted assessment does.
 */

const DIRECTION_TONE: Record<ShapDriver['direction'], StatusTone> = {
  raises_risk: 'danger',
  lowers_risk: 'success',
  neutral: 'neutral',
};

const DIRECTION_LABEL: Record<ShapDriver['direction'], string> = {
  raises_risk: 'Raised the score',
  lowers_risk: 'Lowered the score',
  neutral: 'Little effect',
};

const DIRECTION_BAR: Record<ShapDriver['direction'], string> = {
  raises_risk: 'bg-danger',
  lowers_risk: 'bg-success',
  neutral: 'bg-ink-subtle',
};

function directionIcon(direction: ShapDriver['direction']) {
  const className = `size-4 shrink-0 ${TONE_ICON[DIRECTION_TONE[direction]]}`;
  if (direction === 'raises_risk') return <ArrowUp aria-hidden className={className} />;
  if (direction === 'lowers_risk') return <ArrowDown aria-hidden className={className} />;
  return <Minus aria-hidden className={className} />;
}

/** Descending absolute impact (R4.1) lives in `drivers.ts`, shared with the report. */

/**
 * The submitted value for a field, as text, or `null` when it was not provided.
 *
 * `null` here means the same thing it meant in the request: the user left it blank
 * and the service imputed it. That distinction is shown rather than hidden, because
 * "this driver was based on an estimate" changes how much weight to give it.
 */
function submittedValue(
  assessment: PatientAssessment | null,
  feature: string
): string | null {
  if (assessment === null) return null;
  const raw = (assessment as unknown as Record<string, unknown>)[feature];
  if (raw === null || raw === undefined || raw === '') return null;
  return String(raw);
}

interface DriverListProps {
  drivers: readonly ShapDriver[];
  /** The answers that produced them, for the patient's own value. */
  assessment: PatientAssessment | null;
  /** Field names the service imputed, so an estimate is labelled as one. */
  imputedFields: readonly string[];
  /** `false` on Results, where the drivers are a summary rather than the subject. */
  showValues?: boolean;
}

export function DriverList({
  drivers,
  assessment,
  imputedFields,
  showValues = true,
}: DriverListProps) {
  const ordered = orderDrivers(drivers);
  const largest = ordered.reduce((max, driver) => Math.max(max, Math.abs(driver.value)), 0);
  const imputed = new Set(imputedFields);

  return (
    <ol className="space-y-3">
      {ordered.map((driver, index) => {
        const copy = fieldCopy(driver.feature);
        const label = copy?.label ?? driver.feature;
        const value = submittedValue(assessment, driver.feature);
        const wasEstimated = imputed.has(driver.feature);
        // Guard the divide: an all-zero driver set is possible in principle and
        // would otherwise produce NaN widths.
        const share = largest === 0 ? 0 : (Math.abs(driver.value) / largest) * 100;

        return (
          <li
            key={driver.feature}
            className="rounded-md border border-border bg-surface p-3 sm:p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="font-mono text-xs font-semibold text-ink-subtle tabular-nums"
                >
                  {index + 1}
                </span>
                {directionIcon(driver.direction)}
                <span className="truncate font-medium text-ink">{label}</span>
              </div>

              {showValues && (
                <span className="text-sm text-ink-muted">
                  {value === null ? (
                    <span className="text-ink-subtle italic">not provided</span>
                  ) : (
                    <>
                      <span className="font-mono font-medium text-ink tabular-nums">{value}</span>
                      {copy?.unit ? <span className="ms-1">{copy.unit}</span> : null}
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken"
                role="img"
                aria-label={`${label}: ${DIRECTION_LABEL[driver.direction].toLowerCase()}, ranked ${index + 1} of ${ordered.length} by impact`}
              >
                <div
                  className={`h-full rounded-full ${DIRECTION_BAR[driver.direction]}`}
                  style={{ width: `${share}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-ink-muted">
                {DIRECTION_LABEL[driver.direction]}
              </span>
            </div>

            {wasEstimated && (
              <p className="mt-2">
                <Badge tone="warn">Estimated, not measured</Badge>
              </p>
            )}

            {showValues && copy !== undefined && (
              <p className="mt-2 text-xs text-ink-muted">{copy.help}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

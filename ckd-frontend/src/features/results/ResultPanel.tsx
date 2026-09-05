import { CircleCheck, TriangleAlert, CircleAlert } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Tooltip } from '../../components/ui/Tooltip';
import { TONE_ICON, TONE_PANEL, type StatusTone } from '../../components/ui/styles';
import { BAND_HEADLINE, BAND_MEANING, BAND_TONE } from './bands';
import type { PredictionView, RiskBand } from '../../types/api.types';

/**
 * The result itself.
 *
 * Every presentational decision in this file exists to stop a screening score from
 * reading as a diagnosis:
 *
 * - **The band leads, not the number.** `risk_band` is what the backend is willing
 *   to stand behind, and it is rendered exactly as received. The thresholds that
 *   produced it are not exposed by the API and are not recreated here.
 * - **The score is never shown as a percentage.** `ckd_score` is the model's raw
 *   positive-class output and the backend states plainly that it is not a calibrated
 *   probability. "0.95" on a labelled 0–1 scale invites the right question; "94.7%
 *   chance of kidney disease" is a false claim.
 * - **The verdict is described as a classification.** `prediction` is what the model
 *   would label this record, not what a person has.
 *
 * The band vocabulary lives in `bands.ts`, shared with the batch table and the
 * printed report so one band cannot be styled or worded two ways.
 */

function bandIcon(band: RiskBand, tone: StatusTone) {
  const className = `size-7 shrink-0 ${TONE_ICON[tone]}`;
  if (band === 'LOW') return <CircleCheck aria-hidden className={className} />;
  if (band === 'MODERATE') return <TriangleAlert aria-hidden className={className} />;
  return <CircleAlert aria-hidden className={className} />;
}

export function ResultPanel({ prediction }: { prediction: PredictionView }) {
  const tone = BAND_TONE[prediction.risk_band];

  return (
    <section aria-labelledby="result-heading" className="space-y-4">
      {/*
        `role="status"` with polite announcement: the result appears after a
        navigation the user initiated, so it is expected — but it is the reason they
        are on this page and must be announced rather than waiting to be found.
      */}
      <div
        role="status"
        aria-live="polite"
        className={`flex gap-4 rounded-lg border p-5 sm:p-6 ${TONE_PANEL[tone]}`}
      >
        {bandIcon(prediction.risk_band, tone)}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="result-heading" className="text-xl font-semibold text-ink">
              {BAND_HEADLINE[prediction.risk_band]}
            </h2>
            <Badge tone={tone}>{prediction.risk_band}</Badge>
          </div>
          <p className="text-sm text-ink">{BAND_MEANING[prediction.risk_band]}</p>
        </div>
      </div>

      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Model score</h3>
            <Tooltip label="What is the model score?">
              <span className="block">
                The model outputs a number between 0 and 1 for how much this record
                resembles the kidney-disease cases it was trained on. The service
                states that this number is <strong>not</strong> a calibrated
                probability, so 0.90 does not mean a 90% chance of disease. The risk
                band above is the interpretation the service is willing to give it.
              </span>
            </Tooltip>
          </div>
          <p className="font-mono text-lg font-semibold tabular-nums text-ink">
            {prediction.ckd_score.toFixed(3)}
            <span className="ms-1 text-sm font-normal text-ink-subtle">of 1.000</span>
          </p>
        </div>

        {/* Scale, not a percentage bar. It is labelled 0–1 for that reason. */}
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
          role="img"
          aria-label={`Model score ${prediction.ckd_score.toFixed(3)} on a scale from 0 to 1`}
        >
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(Math.max(prediction.ckd_score, 0), 1) * 100}%` }}
          />
        </div>
        <div aria-hidden className="mt-1 flex justify-between text-xs text-ink-subtle">
          <span>0.000</span>
          <span>1.000</span>
        </div>

        <p className="mt-3 text-xs text-ink-muted">
          Not a probability. The model would label this record{' '}
          <strong className="font-semibold text-ink">
            {prediction.prediction === 'ckd' ? '“CKD”' : '“not CKD”'}
          </strong>{' '}
          — a classification of the numbers you entered, not a statement about your
          health.
        </p>
      </Card>
    </section>
  );
}

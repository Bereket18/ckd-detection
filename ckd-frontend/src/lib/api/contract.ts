/**
 * Response contract checks — the guard between HTTP 200 and rendering.
 *
 * A 200 does not mean the body is usable. If `risk_band` carries a value the
 * frontend has no presentation for, or the disclaimer is missing, the honest
 * outcome is to show nothing and say so — not to render a verdict with a blank
 * band beside it (§7.7). Half a health verdict is worse than none.
 *
 * Deliberately narrow. This checks the fields the result pages actually branch on;
 * it is not a schema validator, and it does not re-derive anything the backend
 * computed. In particular `risk_band` is checked for *recognisability*, never
 * recalculated from `ckd_score` — the thresholds are not exposed and must not be
 * duplicated here.
 */

import type { PredictionResponse, RiskBand, Verdict } from '../../types/api.types';

/** Thrown when a 200 response cannot be displayed safely. */
export class ContractViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractViolation';
  }
}

const RISK_BANDS: readonly RiskBand[] = ['LOW', 'MODERATE', 'HIGH'];
const VERDICTS: readonly Verdict[] = ['ckd', 'notckd'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check a `POST /predict` body and return it typed.
 *
 * `explanation` is allowed to be `null` — the backend returns null when SHAP is
 * unavailable, and the results page renders the drivers without prose in that
 * case. `shap_drivers` is allowed to be empty for the same reason.
 */
export function readPrediction(body: unknown): PredictionResponse {
  if (!isRecord(body)) throw new ContractViolation('response was not an object');

  if (!VERDICTS.includes(body.prediction as Verdict)) {
    throw new ContractViolation('prediction: unrecognised value');
  }

  if (typeof body.ckd_score !== 'number' || !Number.isFinite(body.ckd_score)) {
    throw new ContractViolation('ckd_score: not a finite number');
  }

  if (!RISK_BANDS.includes(body.risk_band as RiskBand)) {
    throw new ContractViolation('risk_band: unrecognised value');
  }

  if (!Array.isArray(body.shap_drivers)) {
    throw new ContractViolation('shap_drivers: not an array');
  }

  if (!Array.isArray(body.imputed_fields)) {
    throw new ContractViolation('imputed_fields: not an array');
  }

  if (typeof body.disclaimer !== 'string' || body.disclaimer.trim() === '') {
    // The disclaimer is not decoration: the result may not be shown without it.
    throw new ContractViolation('disclaimer: missing');
  }

  if (!isRecord(body.model)) {
    throw new ContractViolation('model: missing');
  }

  return body as unknown as PredictionResponse;
}

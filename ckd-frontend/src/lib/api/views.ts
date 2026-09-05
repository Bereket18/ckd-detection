/**
 * View projections — the parse boundary where server internals are dropped.
 *
 * This is layer 1 of the four independent defences in architecture §8.3: a
 * component cannot render `artifacts[*].path` because it never receives it.
 * `safeText()` (layer 2) covers free-text strings, `detail` is never rendered
 * (layer 3), and tests assert all of it (layer 4).
 *
 * `sha256` is kept: it is a safe integrity identifier and is what the Model Card
 * shows. `version` is already `sha256[:12]`, computed by the backend, so the
 * frontend never slices a hash itself (C3).
 */

import type {
  ModelMetadata,
  ModelView,
  PredictionResponse,
  PredictionView,
} from '../../types/api.types';
import { safeText } from './redact';

/** Drop `artifacts[*].path`; redact the free-text `limitations`. */
export function toModelView(model: ModelMetadata): ModelView {
  const artifacts: Record<string, { sha256: string }> = {};
  for (const [name, artifact] of Object.entries(model.artifacts ?? {})) {
    artifacts[name] = { sha256: artifact.sha256 };
  }

  return {
    ...model,
    artifacts,
    limitations: (model.limitations ?? []).map((line) => safeText(line)),
  };
}

/**
 * Project a prediction for display.
 *
 * `POST /predict` embeds the whole `/model` document, so the same path leak
 * reaches Results and Explainability. The embedded block goes through
 * `toModelView` for exactly that reason. `explanation` and `disclaimer` are
 * backend-authored copy: they are redacted but never reworded (plan R3.3, R3.6).
 */
export function toPredictionView(response: PredictionResponse): PredictionView {
  return {
    ...response,
    explanation: response.explanation === null ? null : safeText(response.explanation),
    disclaimer: safeText(response.disclaimer),
    model: toModelView(response.model),
  };
}

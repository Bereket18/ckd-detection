/**
 * The current prediction — in memory, for this navigation session only.
 *
 * ADR-13. A prediction is a health record. It is held in a React context mounted
 * above the router outlet so it survives in-app navigation (Assessment → Results →
 * Explainability and back) and is gone the instant the tab reloads. There is no
 * `sessionStorage` fallback, no query cache entry, and no `localStorage` — the four
 * ways a result could outlive the session are all closed deliberately.
 *
 * The value is a `PredictionView`, not a `PredictionResponse`: `artifacts[*].path`
 * has already been projected out by `toPredictionView` before anything reaches
 * here, so no component downstream can render a filesystem path even by accident
 * (§8.3, defence layer 1).
 *
 * This is not a general-purpose store (ADR-8). The interface below is the whole of
 * it: one value, one setter, one clear. Server data belongs to TanStack Query and
 * form data belongs to React Hook Form; anything tempted to live here should go to
 * one of those instead.
 */

import { createContext, useContext } from 'react';
import type { PatientAssessment, PredictionView } from '../../types/api.types';

export interface PredictionState {
  /** The prediction being viewed, or `null` before one has been made. */
  prediction: PredictionView | null;
  /**
   * The answers that produced it, held under the same rules as the prediction.
   *
   * Explainability has to show the patient's own value beside each SHAP driver
   * (R4.4), and the response does not echo the submitted values back — a driver
   * arrives as `{feature: 'hemo', value: -0.21, direction: 'raises_risk'}` with no
   * indication of what `hemo` was. Naming a driver without its value tells someone
   * that haemoglobin mattered while withholding the only part they could act on.
   *
   * Stored here rather than re-read from the draft because the draft is deleted on
   * submit (§8.5), and it is the *submitted* values that must be shown — not
   * whatever the form happens to contain afterwards.
   */
  assessment: PatientAssessment | null;
  /**
   * When the held prediction was received, as an epoch millisecond value.
   * Results shows it so a user who navigates back after a while can tell whether
   * they are looking at something they just submitted or something older in the
   * same session.
   */
  receivedAt: number | null;
  /**
   * Replace the held prediction. Accepts an already-projected view.
   *
   * The assessment is optional so that a caller with nothing to pass cannot be
   * forced to invent one; omitting it clears any previously held answers rather
   * than leaving the last set attached to a new result.
   */
  setPrediction: (prediction: PredictionView, assessment?: PatientAssessment) => void;
  /** Discard it — on *Start over*, and whenever the assessment is reset. */
  clearPrediction: () => void;
}

/**
 * `null` when no provider is mounted, so `usePrediction` can tell "outside the
 * provider" (a wiring bug) from "inside it with no prediction yet" (normal).
 */
export const PredictionContext = createContext<PredictionState | null>(null);

/**
 * Read the prediction state.
 *
 * Throws outside a provider rather than returning a neutral default. A default
 * would let a Results page render "no prediction" forever while the real cause was
 * a missing provider — a silent failure that survives to production. This one is
 * loud and happens on the first render in development.
 */
export function usePrediction(): PredictionState {
  const context = useContext(PredictionContext);
  if (context === null) {
    throw new Error('usePrediction must be used inside <PredictionProvider>.');
  }
  return context;
}

/**
 * The prediction alone, for the common read-only case.
 *
 * `null` is a legitimate value here and callers are expected to handle it: it is
 * what a user sees when they open `/results` directly, or reload the page, and the
 * correct response is an empty state that offers the assessment — never a blank
 * screen and never invented numbers.
 */
export function usePredictionValue(): PredictionView | null {
  return usePrediction().prediction;
}

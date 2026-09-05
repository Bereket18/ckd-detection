import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PredictionContext, type PredictionState } from './prediction-context';
import type { PatientAssessment, PredictionView } from '../../types/api.types';

interface PredictionProviderProps {
  children: ReactNode;
  /** Test seam only. Production mounts the provider empty. */
  initialPrediction?: PredictionView | null;
  /** Test seam only. The answers that would have produced `initialPrediction`. */
  initialAssessment?: PatientAssessment | null;
}

interface Held {
  prediction: PredictionView | null;
  assessment: PatientAssessment | null;
  receivedAt: number | null;
}

/**
 * Holds the current prediction for the life of the mounted tree.
 *
 * Mounted above the router outlet, so navigating between routes re-renders the
 * outlet without re-mounting this provider and the value survives. A page reload
 * unmounts everything and the prediction is gone — which is the intent, not a
 * limitation to be worked around later.
 *
 * The prediction and its arrival time are one state object rather than two, so they
 * cannot disagree, and `Date.now()` is read inside the setter rather than during
 * render — a clock read during render is not idempotent, and React's purity lint
 * rejects it for good reason.
 *
 * A seeded `initialPrediction` has `receivedAt: null`: nothing arrived, so there is
 * no arrival time to report. Only a real `setPrediction` stamps one.
 *
 * `useMemo` over the context value is load-bearing rather than decorative: this
 * provider sits above every route, so an unstable object would re-render the entire
 * tree on each keystroke of the assessment form.
 */
export function PredictionProvider({
  children,
  initialPrediction = null,
  initialAssessment = null,
}: PredictionProviderProps) {
  const [held, setHeld] = useState<Held>({
    prediction: initialPrediction,
    assessment: initialAssessment,
    receivedAt: null,
  });

  const setPrediction = useCallback((next: PredictionView, assessment?: PatientAssessment) => {
    setHeld({ prediction: next, assessment: assessment ?? null, receivedAt: Date.now() });
  }, []);

  const clearPrediction = useCallback(() => {
    setHeld({ prediction: null, assessment: null, receivedAt: null });
  }, []);

  const value = useMemo<PredictionState>(
    () => ({
      prediction: held.prediction,
      assessment: held.assessment,
      receivedAt: held.receivedAt,
      setPrediction,
      clearPrediction,
    }),
    [held, setPrediction, clearPrediction]
  );

  return <PredictionContext.Provider value={value}>{children}</PredictionContext.Provider>;
}

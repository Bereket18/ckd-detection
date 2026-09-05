/**
 * Write hooks — the two mutations (ADR-4).
 *
 * A prediction is deliberately **not** cached. `useMutation` has no cache entry,
 * which is the point: a `useQuery` keyed on the assessment would leave a health
 * record in memory keyed by the answers that produced it, discoverable by anything
 * holding the client (§7.6). The result goes to the prediction context instead,
 * which is cleared on reload.
 *
 * The response is projected through `toPredictionView` here, at the boundary, so
 * `artifacts[*].path` is gone before the value reaches any component (§8.3).
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { contractError, normalizeError, type NormalizedError } from '../api/errors';
import { ContractViolation, readPrediction } from '../api/contract';
import { toPredictionView } from '../api/views';
import type {
  BatchPredictionResponse,
  PatientAssessment,
  PredictionView,
} from '../../types/api.types';

/**
 * `POST /predict`.
 *
 * Errors arrive already normalized, so a component never sees an `APIError` and
 * never has to decide what a 422 means. A contract failure — HTTP 200 with a body
 * the frontend cannot read safely — is normalized the same way rather than being
 * rendered as a partial result (§7.7).
 */
export function usePredictOne(): UseMutationResult<
  PredictionView,
  NormalizedError,
  PatientAssessment
> {
  return useMutation<PredictionView, NormalizedError, PatientAssessment>({
    mutationFn: async (assessment) => {
      try {
        return toPredictionView(readPrediction(await apiClient.predictSingle(assessment)));
      } catch (error) {
        if (error instanceof ContractViolation) throw contractError(error.message);
        throw normalizeError(error);
      }
    },
  });
}

export interface BatchInput {
  body: string;
  contentType?: string;
  explain?: boolean;
}

/** `POST /predict/batch`. Research-side; no projection, as no model block is returned. */
export function usePredictBatch(): UseMutationResult<
  BatchPredictionResponse,
  NormalizedError,
  BatchInput
> {
  return useMutation<BatchPredictionResponse, NormalizedError, BatchInput>({
    mutationFn: async (input) => {
      try {
        return await apiClient.predictBatch(input);
      } catch (error) {
        throw normalizeError(error);
      }
    },
  });
}

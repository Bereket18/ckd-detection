/**
 * Read hooks — the only place query keys are used.
 *
 * Components consume these; they never call the client and never see a raw
 * response (§7.1). Each hook returns already-projected data, so a filesystem
 * path cannot travel further up (§8.3).
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { toModelView } from '../api/views';
import { normalizeError, type NormalizedError } from '../api/errors';
import { healthCheckInterval, queryKeys, shouldRetry } from './client';
import type { ModelView, OpenApiDocument } from '../../types/api.types';

/**
 * Four states, not three.
 *
 * `degraded` is distinct from `unreachable` because the API answers a degraded
 * health probe with **HTTP 200** (§0.2): the request succeeded, the service is
 * not usable. Collapsing the two would either block on a healthy API or accept a
 * degraded one.
 */
export type HealthState = 'checking' | 'ready' | 'degraded' | 'unreachable';

export interface HealthStatus {
  state: HealthState;
  /** `true` only when the API can actually score a patient. */
  ready: boolean;
  /** Number of features the loaded model expects, when the API reports one. */
  featureCount: number | null;
  error: NormalizedError | null;
  refetch: () => void;
  isFetching: boolean;
}

export function useHealth(): HealthStatus {
  const query = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => apiClient.checkHealth({ signal }),
    // A liveness probe, so this one is not cached for the session.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchInterval: healthCheckInterval(),
    // A hidden tab does not poll.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => shouldRetry(failureCount, error, 1),
  });

  const state: HealthState = query.isPending
    ? 'checking'
    : query.isError
      ? 'unreachable'
      : query.data?.status === 'ok'
        ? 'ready'
        : 'degraded';

  return {
    state,
    ready: state === 'ready',
    featureCount: query.data?.feature_count ?? null,
    error: query.error ? normalizeError(query.error) : null,
    refetch: () => void query.refetch(),
    isFetching: query.isFetching,
  };
}

/**
 * There is deliberately no hook returning the raw `HealthResponse`.
 *
 * One existed — `useHealthResponse`, "for the rare consumer that needs a specific
 * field" — with no consumer. It was the only route by which a component could hold
 * `health.detail`, which on a degraded probe carries an absolute server path, and
 * a degraded probe arrives with HTTP 200 so nothing else stops it. An unused bypass
 * around a security boundary means the boundary holds only while nobody calls it,
 * so it is gone (§8.3, layer 1).
 *
 * A later phase that needs `schema_compatible` should add a projected field to
 * {@link HealthStatus}, not hand over the document.
 */

/**
 * `/model`, projected so `artifacts[*].path` is gone before any component can
 * reach it. `feature_schema` from here is the source of field identity and order
 * (ADR-7).
 */
export function useModelMetadata(): UseQueryResult<ModelView, NormalizedError> {
  return useQuery({
    queryKey: queryKeys.model,
    // Normalized here, not at each call site: the return type promises consumers a
    // `NormalizedError`, and a cast alone would have made that true only for the
    // compiler — `ErrorState` would have received a raw `APIError` and rendered an
    // empty panel. Same pattern the mutations use.
    queryFn: async ({ signal }) => {
      try {
        return toModelView(await apiClient.getModelMetadata({ signal }));
      } catch (error) {
        throw normalizeError(error);
      }
    },
    // §7.3 unchanged, restated against the normalized shape: 4xx never (not
    // retryable), timeouts never automatically, network and 5xx twice.
    retry: (failureCount, error: NormalizedError) =>
      error.kind !== 'timeout' && error.retryable && failureCount < 2,
    throwOnError: false,
  });
}

/**
 * `/openapi.json`, the source of numeric bounds and enum values. Fetched as a
 * document; deriving field constraints from it is the assessment's job.
 */
export function useOpenApi(): UseQueryResult<OpenApiDocument> {
  return useQuery({
    queryKey: queryKeys.openapi,
    queryFn: ({ signal }) => apiClient.getOpenApi({ signal }),
  });
}

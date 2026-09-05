/**
 * Query client configuration.
 *
 * TanStack Query owns exactly three server reads and two mutations (ADR-4).
 * Nothing else goes in the cache — in particular not the prediction, because a
 * cached prediction is a stored health record (§7.6).
 */

import { QueryClient } from '@tanstack/react-query';
import { APIError, TimeoutError } from '../api/client';

/**
 * Every query key in the application. Keys live here and nowhere else, so a
 * cache invalidation cannot miss a call site that spelled the key differently.
 */
export const queryKeys = {
  health: ['health'] as const,
  model: ['model'] as const,
  openapi: ['openapi'] as const,
  /** Derived from `model` + `openapi`; never fetched directly (§7.2). */
  fieldSchema: ['fieldSchema'] as const,
} as const;

/** How often `/health` is re-probed. Configurable; 60 s by default. */
export function healthCheckInterval(): number {
  const configured = Number(import.meta.env.VITE_HEALTH_CHECK_INTERVAL);
  return Number.isFinite(configured) && configured > 0 ? configured : 60_000;
}

/**
 * Retry policy (§7.3).
 *
 * - 4xx: never. A 422, 415, or 404 will not fix itself, and retrying a rejected
 *   submission wastes the user's time twice.
 * - Timeout: never automatically. A 30-second wait already happened; silently
 *   repeating it makes the application feel broken. The user gets *Try again*.
 * - Network and 5xx: up to `max` attempts, because those are the failures that
 *   genuinely do resolve on their own.
 */
export function shouldRetry(failureCount: number, error: unknown, max: number): boolean {
  if (error instanceof TimeoutError) return false;
  if (error instanceof APIError && error.status >= 400 && error.status < 500) return false;
  return failureCount < max;
}

/** 1 s, then 2 s. Capped so a slow backend cannot stall a page for a minute. */
export const retryDelay = (attempt: number): number => Math.min(1_000 * 2 ** attempt, 4_000);

/**
 * Build a client. A factory rather than a module-level singleton so each test
 * gets an isolated cache — a shared client leaks state between tests and is the
 * usual reason a query test passes alone and fails in a suite.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => shouldRetry(failureCount, error, 2),
        retryDelay,
        refetchOnWindowFocus: false,
        // `/model` and `/openapi.json` are immutable within a session and carry
        // no ETag or Cache-Control, so there is nothing to revalidate against.
        staleTime: Infinity,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

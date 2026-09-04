/**
 * API layer public surface.
 *
 * Components import from here, never from a transport file directly, so the
 * layering in architecture §7.1 stays visible in the import graph.
 */

export {
  APIClient,
  APIError,
  NetworkError,
  TimeoutError,
  apiClient,
  DEFAULT_BASE_URL,
  type RequestOptions,
} from './client';

export { ErrorHandler, errorHandler } from './error-handler';

export {
  normalizeError,
  contractError,
  FIELD_MESSAGES,
  type NormalizedError,
  type NormalizedFieldError,
  type NormalizedRowError,
  type ErrorKind,
} from './errors';

export { safeText, containsPath, REDACTED } from './redact';

export { toModelView, toPredictionView } from './views';

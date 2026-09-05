/**
 * API client — transport only.
 *
 * Four responsibilities and no others (architecture §7.1): build the URL, set
 * the headers, enforce the timeout, and throw a typed error. It does not retry,
 * cache, or decide user-facing wording. Retry and caching belong to the query
 * layer; wording belongs to `ErrorHandler`. `APIError.message` therefore stays
 * the raw `"<status> <statusText>"` — that layering was established in Phase 0
 * and is preserved deliberately.
 *
 * Moved here from `src/services/api.ts` in Phase 2 to match architecture §7.1.
 * Same class, same error types, same behaviour — not a second client.
 */

import type {
  PatientAssessment,
  PredictionResponse,
  BatchPredictionResponse,
  HealthResponse,
  ModelMetadata,
  OpenApiDocument,
} from '../../types/api.types';
import { devLog, devLogFailure } from '../log';

/** An HTTP response outside 2xx. `message` is raw by design; see the file note. */
export class APIError extends Error {
  status: number;
  statusText: string;
  body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`${status} ${statusText}`);
    this.name = 'APIError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/** The request exceeded {@link APIClient} timeout. Never a failed prediction. */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** The request never reached the API. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Per-call options. `signal` lets the query layer cancel an in-flight GET. */
export interface RequestOptions {
  signal?: AbortSignal;
}

interface InternalRequest extends RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: string;
  contentType?: string;
  accept?: string;
}

/**
 * Default base URL is the **relative** `/api` (ADR-9). In development Vite's
 * proxy forwards it to FastAPI on `:8000`; in production the host is required to
 * proxy the same path. Both make CORS irrelevant. `VITE_API_BASE_URL` remains an
 * opt-in override for a split-origin deployment, where CORS becomes load-bearing
 * again and the backend's allowed origins would need to change.
 */
export const DEFAULT_BASE_URL = '/api';

const DEFAULT_TIMEOUT_MS = 30_000;

function resolveBaseURL(override?: string): string {
  const configured = override ?? import.meta.env.VITE_API_BASE_URL;
  const value = typeof configured === 'string' && configured.trim() !== '' ? configured : DEFAULT_BASE_URL;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function resolveTimeout(override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) return override;
  const configured = Number(import.meta.env.VITE_API_TIMEOUT);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/**
 * Compose the timeout with a caller-supplied signal.
 *
 * Both can abort the same `fetch`, and the two outcomes are different: a timeout
 * is a `TimeoutError` the user is told about, while a caller abort is a
 * cancellation that must propagate untranslated so TanStack Query recognises it.
 * `reason` records which fired.
 */
function composeAbort(
  timeoutMs: number,
  external: AbortSignal | undefined
): { signal: AbortSignal; timedOut: () => boolean; release: () => void } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    release: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

export class APIClient {
  private readonly baseURL: string;
  private readonly timeout: number;

  constructor(options?: { baseURL?: string; timeout?: number }) {
    this.baseURL = resolveBaseURL(options?.baseURL);
    this.timeout = resolveTimeout(options?.timeout);
  }

  /** The resolved base URL, exposed so configuration can be asserted in tests. */
  get base(): string {
    return this.baseURL;
  }

  /** `GET /health`. A degraded API answers 200 — the caller must read `status`. */
  async checkHealth(options?: RequestOptions): Promise<HealthResponse> {
    return this.request<HealthResponse>({ method: 'GET', path: '/health', ...options });
  }

  /** `GET /model`. Returns the verified metadata shape, `artifacts` included. */
  async getModelMetadata(options?: RequestOptions): Promise<ModelMetadata> {
    return this.request<ModelMetadata>({ method: 'GET', path: '/model', ...options });
  }

  /**
   * `GET /openapi.json` — the source of numeric bounds and enum values for the
   * 24 fields, so no constraint is ever copied into frontend source (§6.1).
   */
  async getOpenApi(options?: RequestOptions): Promise<OpenApiDocument> {
    return this.request<OpenApiDocument>({ method: 'GET', path: '/openapi.json', ...options });
  }

  /** `POST /predict`. */
  async predictSingle(
    assessment: PatientAssessment,
    options?: RequestOptions
  ): Promise<PredictionResponse> {
    return this.request<PredictionResponse>({
      method: 'POST',
      path: '/predict',
      body: JSON.stringify(assessment),
      contentType: 'application/json',
      ...options,
    });
  }

  /**
   * `POST /predict/batch`.
   *
   * Content type is a parameter rather than a hardcoded `text/csv`, because the
   * route also accepts JSON, and `explain` is a real query parameter that the
   * batch UI needs. Note that `/predict/batch` declares no `requestBody` in
   * OpenAPI, so its accepted media types are not discoverable from the schema.
   */
  async predictBatch(
    payload: { body: string; contentType?: string; explain?: boolean },
    options?: RequestOptions
  ): Promise<BatchPredictionResponse> {
    const explain = payload.explain === true ? '?explain=true' : '';
    return this.request<BatchPredictionResponse>({
      method: 'POST',
      path: `/predict/batch${explain}`,
      body: payload.body,
      contentType: payload.contentType ?? 'text/csv',
      ...options,
    });
  }

  /** The single transport path. Every method above funnels through it. */
  private async request<T>({
    method,
    path,
    body,
    contentType,
    accept = 'application/json',
    signal: externalSignal,
  }: InternalRequest): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const abort = composeAbort(this.timeout, externalSignal);
    const started = Date.now();

    // Method and path only. Never a body, in any environment (§8.5).
    devLog(`→ ${method} ${url}`);

    try {
      const headers: Record<string, string> = { Accept: accept };
      if (contentType) headers['Content-Type'] = contentType;

      const response = await fetch(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: abort.signal,
      });

      devLog(`← ${response.status} ${method} ${url} ${Date.now() - started}ms`);

      if (!response.ok) {
        throw new APIError(response.status, response.statusText, await readBody(response));
      }

      return (await readBody(response)) as T;
    } catch (error) {
      throw this.translate(error, abort.timedOut(), method, url);
    } finally {
      abort.release();
    }
  }

  /**
   * Map a thrown value to one of the three error classes.
   *
   * A caller-initiated abort is re-thrown unchanged: it is a cancellation, not a
   * failure, and translating it would make an unmounted component look broken.
   */
  private translate(error: unknown, timedOut: boolean, method: string, url: string): unknown {
    if (error instanceof APIError) {
      devLogFailure(`✗ ${method} ${url}`, `${error.status}`);
      return error;
    }

    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isAbort && !timedOut) return error;

    if (isAbort) {
      devLogFailure(`✗ ${method} ${url}`, 'timeout');
      return new TimeoutError(`Request timed out after ${this.timeout}ms`);
    }

    devLogFailure(`✗ ${method} ${url}`, error instanceof Error ? error.name : 'unknown');
    return new NetworkError('Unable to reach the API. Please check your network connection.');
  }
}

/**
 * Read a response body without assuming JSON.
 *
 * 415 and 503 send `detail` as a bare string and an error page may not be JSON
 * at all, so the fallback to text is load-bearing rather than defensive.
 */
async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

/** Shared instance. One client for the whole application. */
export const apiClient = new APIClient();

/**
 * API client tests.
 *
 * The Phase 0 suite asserted an absolute `http://localhost:8000` URL and that
 * request bodies were logged in development. Both of those are now deliberately
 * false — the base URL is the relative `/api` so Vite's proxy handles the hop and
 * CORS is never exercised (ADR-9), and no body is logged in any environment
 * (§8.5). These tests assert the new behaviour, including the absences.
 *
 * Timeouts are tested with a 5 ms client timeout and real timers rather than
 * `vi.useFakeTimers()`. The Phase 0 audit traced two hanging tests to fake timers
 * that `waitFor` then polled without advancing; a genuinely short real timeout is
 * deterministic and cannot deadlock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIClient, APIError, DEFAULT_BASE_URL, NetworkError, TimeoutError } from './client';
import { MODEL_FIXTURE, HEALTH_OK_FIXTURE } from '../../../tests/fixtures/api';
import type { PatientAssessment } from '../../types/api.types';

/**
 * A response stand-in built from a plain object rather than `new Response()`, so
 * the test does not depend on which `Response` implementation the jsdom
 * environment happens to expose.
 */
function stubResponse(
  status: number,
  body: unknown,
  { statusText = '', contentType = 'application/json' } = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function mockFetch(response: Response) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

/** The call arguments of the most recent `fetch`. */
function lastCall(spy: ReturnType<typeof mockFetch>) {
  const call = spy.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return { url: String(call[0]), init: call[1] as RequestInit };
}

describe('APIClient configuration', () => {
  it('defaults to the relative /api base so the dev proxy is used, not CORS', () => {
    expect(DEFAULT_BASE_URL).toBe('/api');
    expect(new APIClient().base).toBe('/api');
  });

  it('never resolves to an absolute backend origin by default', () => {
    expect(new APIClient().base).not.toMatch(/^https?:\/\//);
  });

  it('accepts an explicit base for a split-origin deployment', () => {
    expect(new APIClient({ baseURL: 'https://api.example.test' }).base).toBe(
      'https://api.example.test'
    );
  });

  it('strips a trailing slash so paths do not double up', () => {
    expect(new APIClient({ baseURL: '/api/' }).base).toBe('/api');
  });

  it('falls back to the default when given an empty override', () => {
    expect(new APIClient({ baseURL: '   ' }).base).toBe('/api');
  });
});

describe('APIClient requests', () => {
  let client: APIClient;

  beforeEach(() => {
    client = new APIClient();
  });

  it('GETs /api/health and returns the parsed body', async () => {
    const spy = mockFetch(stubResponse(200, HEALTH_OK_FIXTURE));

    await expect(client.checkHealth()).resolves.toEqual(HEALTH_OK_FIXTURE);
    expect(lastCall(spy).url).toBe('/api/health');
    expect(lastCall(spy).init.method).toBe('GET');
  });

  it('GETs /api/model', async () => {
    const spy = mockFetch(stubResponse(200, MODEL_FIXTURE));

    await expect(client.getModelMetadata()).resolves.toEqual(MODEL_FIXTURE);
    expect(lastCall(spy).url).toBe('/api/model');
  });

  it('GETs /api/openapi.json — the source of field bounds and enums', async () => {
    const spy = mockFetch(stubResponse(200, { components: { schemas: {} } }));

    await client.getOpenApi();
    expect(lastCall(spy).url).toBe('/api/openapi.json');
  });

  it('sends no Content-Type on a GET, because there is no body to describe', async () => {
    const spy = mockFetch(stubResponse(200, HEALTH_OK_FIXTURE));

    await client.checkHealth();
    const headers = lastCall(spy).init.headers as Record<string, string>;
    expect(headers['Accept']).toBe('application/json');
    expect(headers['Content-Type']).toBeUndefined();
    expect(lastCall(spy).init.body).toBeUndefined();
  });

  it('POSTs /api/predict as JSON', async () => {
    const spy = mockFetch(stubResponse(200, { prediction: 'notckd' }));
    const assessment = { age: 45, sc: 1.2 } as unknown as PatientAssessment;

    await client.predictSingle(assessment);
    const { url, init } = lastCall(spy);
    expect(url).toBe('/api/predict');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify(assessment));
  });

  it('POSTs /api/predict/batch as text/csv by default', async () => {
    const spy = mockFetch(stubResponse(200, { count: 0, results: [] }));

    await client.predictBatch({ body: 'age,bp\n45,80\n' });
    const { url, init } = lastCall(spy);
    expect(url).toBe('/api/predict/batch');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/csv');
  });

  it('adds ?explain=true only when explain is requested', async () => {
    const spy = mockFetch(stubResponse(200, { count: 0, results: [] }));

    await client.predictBatch({ body: 'age\n45\n', explain: true });
    expect(lastCall(spy).url).toBe('/api/predict/batch?explain=true');

    await client.predictBatch({ body: 'age\n45\n', explain: false });
    expect(lastCall(spy).url).toBe('/api/predict/batch');
  });

  it('passes a caller signal through so a query can cancel an in-flight GET', async () => {
    const spy = mockFetch(stubResponse(200, HEALTH_OK_FIXTURE));
    const controller = new AbortController();

    await client.checkHealth({ signal: controller.signal });
    expect(lastCall(spy).init.signal).toBeInstanceOf(AbortSignal);
    // Composed, not forwarded: the timeout must be able to abort it too.
    expect(lastCall(spy).init.signal).not.toBe(controller.signal);
  });
});

describe('APIClient error translation', () => {
  it('throws APIError whose message stays the raw status line', async () => {
    mockFetch(stubResponse(422, { detail: [] }, { statusText: 'Unprocessable Entity' }));

    const error = await new APIClient().predictSingle({} as PatientAssessment).catch((e) => e);

    expect(error).toBeInstanceOf(APIError);
    // The friendly wording belongs to ErrorHandler, not to the transport layer.
    expect((error as APIError).message).toBe('422 Unprocessable Entity');
    expect((error as APIError).status).toBe(422);
  });

  it('keeps a bare-string detail intact, as 415 and 503 send one', async () => {
    mockFetch(
      stubResponse(415, 'Unsupported Media Type: send text/csv', {
        statusText: 'Unsupported Media Type',
        contentType: 'text/plain',
      })
    );

    const error = (await new APIClient()
      .predictBatch({ body: 'x' })
      .catch((e) => e)) as APIError;

    expect(error.status).toBe(415);
    expect(error.body).toBe('Unsupported Media Type: send text/csv');
  });

  it('translates a failed fetch into NetworkError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await new APIClient().checkHealth().catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).message).toMatch(/network/i);
  });

  /**
   * A fetch that only settles when its signal aborts — the shape of a request to
   * a backend that has stopped answering.
   */
  function hangingFetch() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const fail = () => {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            reject(error);
          };
          if (init?.signal?.aborted) fail();
          else init?.signal?.addEventListener('abort', fail, { once: true });
        })
    );
  }

  it('converts its own timeout into TimeoutError', async () => {
    hangingFetch();
    const client = new APIClient({ timeout: 5 });

    const error = await client.checkHealth().catch((e) => e);

    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).message).toContain('5ms');
  });

  it('re-throws a caller abort unchanged, because cancelling is not failing', async () => {
    hangingFetch();
    const controller = new AbortController();
    controller.abort();

    const error = await new APIClient({ timeout: 30_000 })
      .checkHealth({ signal: controller.signal })
      .catch((e) => e);

    // TanStack Query treats AbortError as a cancellation; a TimeoutError here
    // would surface "the request timed out" on a component that just unmounted.
    expect(error).not.toBeInstanceOf(TimeoutError);
    expect((error as Error).name).toBe('AbortError');
  });
});

/**
 * §8.5: no request or response body is logged, in any environment. A patient's
 * serum creatinine in a browser console is a disclosure, and consoles are
 * screen-shared, captured by extensions, and kept in crash reports.
 */
describe('APIClient logging', () => {
  it('logs method, path and status but never the request body', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    mockFetch(stubResponse(200, { prediction: 'notckd' }));

    await new APIClient().predictSingle({ age: 61, sc: 7.3 } as unknown as PatientAssessment);

    const logged = debug.mock.calls.flat().join(' | ');
    expect(logged).toContain('/api/predict');
    expect(logged).not.toContain('7.3');
    expect(logged).not.toContain('61');
    expect(logged).not.toContain('sc');
  });

  it('never logs a response body, including an error body', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    mockFetch(
      stubResponse(
        503,
        { detail: 'Model artifact not found at C:\\Users\\berek\\saved_models\\model.joblib' },
        { statusText: 'Service Unavailable' }
      )
    );

    await new APIClient().checkHealth().catch(() => undefined);

    const logged = debug.mock.calls.flat().join(' | ');
    expect(logged).not.toContain('C:\\');
    expect(logged).not.toContain('saved_models');
  });
});

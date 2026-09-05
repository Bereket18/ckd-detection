import { render, type RenderResult } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppProviders } from '../src/AppProviders';
import { createQueryClient } from '../src/lib/query/client';
import { ROUTES } from '../src/routes/routes';
import { HEALTH_OK_FIXTURE } from './fixtures/api';

/**
 * Test helpers for mounting the real application tree.
 *
 * `renderApp` uses `ROUTES` itself rather than a hand-built router, so the coverage
 * test asserts the table that actually ships. Anything mounted from a parallel route
 * list would pass while the real one was broken.
 */

/**
 * Stub `fetch` with a healthy `/health` and 404 for everything else.
 *
 * The shell mounts `useHealth`, so every route render performs one request. Without
 * this the setup file's throwing guard fires and the failure looks like a routing bug
 * rather than a missing stub.
 */
export function stubHealthyApi(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/health')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(HEALTH_OK_FIXTURE),
        text: () => Promise.resolve(JSON.stringify(HEALTH_OK_FIXTURE)),
      } as unknown as Response);
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ detail: 'Not Found' }),
      text: () => Promise.resolve('{"detail":"Not Found"}'),
    } as unknown as Response);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export interface RenderAppResult extends RenderResult {
  router: ReturnType<typeof createMemoryRouter>;
}

export function renderApp(path = '/'): RenderAppResult {
  const router = createMemoryRouter(ROUTES, { initialEntries: [path] });
  const result = render(
    <AppProviders queryClient={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>
  );
  return { ...result, router };
}

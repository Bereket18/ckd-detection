import '@testing-library/jest-dom';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

/**
 * Test environment setup, shared by the unit, component and accessibility tiers.
 *
 * The important part is the `fetch` guard. Three of the six tiers are defined as
 * *no-network* (test plan §1.4), and the usual way that guarantee rots is a test
 * that quietly hits a real port and passes anyway on the developer's machine
 * while failing in CI. Installing a throwing `fetch` makes an unmocked request a
 * loud, immediate failure that names the file.
 *
 * A test that genuinely needs a fetch stub replaces it with `vi.spyOn` or
 * `vi.stubGlobal`; `restoreMocks` in `vite.config.ts` puts the guard back
 * afterwards.
 */
expect.extend(toHaveNoViolations);

const unmockedFetch = () =>
  Promise.reject(
    new Error(
      'Unmocked network request. Unit, component and accessibility tests must not ' +
        'touch the network — stub fetch with vi.spyOn(globalThis, "fetch") or move ' +
        'the test to the integration tier (Phase 5, MSW).'
    )
  );

vi.stubGlobal('fetch', vi.fn(unmockedFetch));

/**
 * jsdom has no layout, so `scrollTo` is unimplemented and every route change in
 * `AppShell` prints a "Not implemented" notice. Stubbed rather than left to warn:
 * a test log with expected noise in it is a log nobody reads, and the real scroll
 * position is on the manual checklist where it can actually be observed.
 */
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });

// Re-installed per test rather than once per file, so `restoreMocks` handing a
// spy back cannot leave the guard uninstalled for whatever runs next.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(unmockedFetch));
});

afterEach(() => {
  cleanup();
  // sessionStorage is real in jsdom and persists across tests in a file; the
  // draft key would otherwise leak from one assertion into the next.
  sessionStorage.clear();
});

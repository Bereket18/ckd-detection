import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Vite configuration.
 *
 * Two decisions here carry architectural weight:
 *
 * - **The `/api` proxy is the only way the browser reaches FastAPI** (ADR-9). The
 *   client sends relative `/api/...` requests, so in development the origin is
 *   `:5173` and CORS never enters the picture; in production the same relative
 *   path is served by whatever reverse proxy fronts the bundle. No absolute
 *   backend origin is compiled into the build.
 * - **Source maps are off in production builds.** A map republishes the entire
 *   `src/` tree, including the redaction and provenance logic, to anyone who
 *   opens devtools. Nothing here needs field-level debugging in production.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // FastAPI serves `/health`, not `/api/health`.
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // No `manualChunks`. Rollup's own graph plus route-level `lazy()` splitting
    // keeps `recharts` out of the initial bundle; a hand-written substring rule
    // would force it in, which is the opposite of what the route split is for.
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    // jsdom performs no layout, so parsing Tailwind buys nothing and costs a
    // full CSS pipeline run per test file. Visual checks happen in the browser.
    css: false,
    // A mock that outlives its test is how a suite starts passing alone and
    // failing together (the Phase 0 fake-timer failures were this shape).
    restoreMocks: true,
    clearMocks: true,
    /**
     * Worker concurrency is capped, and this is a correctness setting rather than
     * a performance one.
     *
     * Left unbounded, Vitest forks one worker per core. Every worker in this suite
     * builds a jsdom document and mounts the whole routed application, so the cost
     * is memory-per-worker, not CPU. On a developer machine that overcommits and
     * the suite fails in two different ways depending on which limit is hit first:
     * V8 aborts a worker (`Zone Allocation failed` / `young object promotion
     * failed`, heap in the tens of MB), or Windows refuses the fork outright
     * (`spawn UNKNOWN`, `errno -4094`). Both surface as the *test file* being
     * broken, which is what sent Phase 2 chasing a non-existent leak in
     * `tests/unit/shell.test.tsx` — that file passes 11/11 on its own.
     *
     * Two workers keeps the suite inside its memory budget and, because the failure
     * mode is a race between workers, keeps it deterministic. Raise it only with
     * the full suite green on the slowest machine that has to run it.
     */
    maxWorkers: 2,
  },
});

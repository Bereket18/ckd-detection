# ckd-frontend

Frontend for **EthioCKD — Explainable AI for CKD Risk Screening**.

> **State: Phase 0 complete.** The Vite starter UI and the superseded form components have been
> removed; the verified data layer was kept and repaired. No product UI exists yet.
>
> Authoritative requirements: [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md).
> Why the requirements changed: [`../FRONTEND_REQUIREMENTS_RECONCILIATION.md`](../FRONTEND_REQUIREMENTS_RECONCILIATION.md).
> `.kiro/specs/ckd-frontend/` is historical and marked SUPERSEDED — do not implement from it.

## Stack

Vite 8 · React 19 · TypeScript (strict) · Vitest + React Testing Library · Zod · React Hook Form.

React Router, Tailwind, Lucide, Recharts, TanStack Query, and MSW are **not installed yet** — they
arrive in Phase 2 with the code that uses them.

## What is here

```text
src/
  main.tsx                 bare mount; placeholder until Phase 2 adds the router
  types/
    api.types.ts           mirrors api/schemas.py — verified field-by-field
    validation.schema.ts    Zod schema for the 24 fields, all nullable
    index.ts  README.md
  services/
    api.ts                 APIClient: AbortController timeouts, APIError /
                           TimeoutError / NetworkError
    error-handler.ts       ErrorHandler: turns those into user-facing copy
    index.ts
  utils/
    field-metadata.ts      labels, units, ranges, sections, clinical tooltips
tests/setup.ts
```

Layering worth knowing before you touch the services: `APIError.message` is deliberately the raw
`"<status> <statusText>"`. All user-facing wording comes from `ErrorHandler.handleAPIError()`.
Components read the handler, never the raw error.

## Commands

```bash
npm install
npm run dev            # http://localhost:5173 — the port the backend's CORS allows
npm run build          # tsc -b && vite build
npm run lint
npm run test:run
npm run format
```

All four of `tsc --noEmit -p tsconfig.app.json`, `eslint .`, `vitest run`, and `npm run build` pass as
of Phase 0. If `npm run build` ever dies with `FATAL ERROR: Zone Allocation failed - process out of
memory`, it is a stale incremental artefact, not a real memory problem — `rm -rf node_modules/.tmp`
and re-run. See risk 9 in [`../FRONTEND_PLAN.md`](../FRONTEND_PLAN.md).

## Backend

The FastAPI backend is a protected dependency and is never modified from here. Start it separately:

```bash
venv/Scripts/python.exe -m uvicorn api.main:app --port 8000
```

Four routes exist: `GET /health`, `GET /model`, `POST /predict`, `POST /predict/batch`. Anything
else a design document mentions does not exist — see the reconciliation report for the list of
planned backend dependencies.

The field schema is read from the backend, never hardcoded: names and order from
`/model.feature_schema`, bounds and enums from `/openapi.json`, and human-readable copy from a
frontend content layer guarded by a parity test. `field-metadata.ts` is the precursor to that
content layer.

## Rules that are enforced by tests, not just documented

- Never render `model.artifacts[*].path` — `/model` currently returns absolute server paths.
- Never recompute `risk_band`, SHAP direction, or imputation flags; read them from the response.
- Never describe `ckd_score` as a calibrated probability; the backend states it is not one.
- Never write patient data to `localStorage`; in-progress input goes to `sessionStorage` only.
- No secret in any `VITE_*` variable or `.env.*` file — they are inlined into the browser bundle.

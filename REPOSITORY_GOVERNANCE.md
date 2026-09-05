# Repository Governance

**Project:** EthioCKD-Agent
**Repository:** https://github.com/Bereket18/ckd-detection
**Established:** 2026-09-04

This document is the single source of conventions for all future development.
Every rule here has a reason. Where the reason is non-obvious, it is stated.

---

## Table of Contents

- [Branches](#branches)
- [Commits](#commits)
- [Pull requests](#pull-requests)
- [CI](#ci)
- [Secrets and environment variables](#secrets-and-environment-variables)
- [Documentation](#documentation)
- [Dependencies](#dependencies)
- [What is in main](#what-is-in-main)
- [What never goes in main](#what-never-goes-in-main)
- [Research integrity rules](#research-integrity-rules)

---

## Branches

### Naming convention

| Prefix | Use |
|---|---|
| `feat/` | New capability |
| `fix/` | Bug fix |
| `refactor/` | Internal restructuring with no behaviour change |
| `docs/` | Documentation only |
| `test/` | Test additions or corrections |
| `ci/` | Workflow changes |
| `chore/` | Dependency bumps, gitignore, tooling, cleanup |
| `research/` | Exploratory work that may not merge |

One purpose per branch. A branch that fixes a bug and updates the README is two commits on one branch, not two branches — but a branch that fixes a bug *and* adds a new feature should be split.

### Lifecycle

```
git checkout main && git pull
git checkout -b feat/my-feature
# implement, test, commit
git push -u origin feat/my-feature
# open PR → CI passes → merge → delete branch
```

Delete branches after merge. GitHub's "Delete branch" button on a merged PR does this in one click.

### Protected branch

`main` is the stable branch. Direct pushes to `main` are discouraged after the initial sprint history. All new work arrives through PRs.

---

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <short description in imperative mood>

<optional body — what and why, not how>
```

### Types

| Type | When to use |
|---|---|
| `feat` | New user-visible capability |
| `fix` | Corrects a bug |
| `docs` | Documentation only |
| `test` | Tests added or corrected, no source changes |
| `refactor` | Internal restructuring, behaviour unchanged |
| `perf` | Performance improvement |
| `build` | Build system (Makefile, vite.config, setup.ps1) |
| `ci` | Workflow files under `.github/workflows/` |
| `chore` | Dependency bumps, gitignore, tooling, generated files |
| `style` | Formatting only (no logic change) |
| `revert` | Reverts a previous commit |

### Scopes (useful for this project)

`api`, `frontend`, `model`, `pipeline`, `agent`, `data`, `ci`, `docs`, `repo`

### Examples

```
feat(api): add /predict/batch endpoint with CSV and JSON support
fix(api): redact filesystem paths from /model artifact metadata
docs(readme): rebuild project README as engineering showcase
ci(frontend): add TypeScript, ESLint, Vitest, and build workflow
chore(gitignore): close root node_modules and .env gaps
refactor(agent): extract dialogue FSM from chatbot loop
test(pipeline): add preprocessing leakage regression test
feat(frontend): implement Phase 2 component architecture
```

### What not to write

These message patterns signal that a commit needs a better description:

- `update`, `changes`, `fixes`, `stuff`, `work`, `final`, `test again`
- `re-trigger actions workflow` — use `workflow_dispatch` in the GitHub UI instead
- Hardcoded metric values in commit messages — the right place is a test or a JSON file

### One logical change per commit

A commit that fixes a bug, adds a test, updates the README, and bumps a dependency is four commits. Atomic commits make `git bisect` and `git revert` useful.

---

## Pull requests

Every change to `main` should go through a PR.

### Title

Follow the same `type(scope): description` format as commits. The PR title becomes the merge commit message if you squash.

### Description

Use the template in `.github/pull_request_template.md`. Fill in every section. The Validation section is the most important — describe exactly what you ran and what it produced.

### Checklist before marking ready

- CI passes (both `tests` and `frontend` if you touched frontend code)
- No secrets in any committed file
- Commit messages follow Conventional Commits
- Documentation updated if any user-visible behaviour changed
- No hardcoded metric numbers (all figures must come from `saved_models/tabular_metrics.json` or be measured at PR time with a method stated)

### Draft PRs

Open as a draft when the branch is in progress. Convert to ready when CI passes and the checklist is complete.

### Merging

Prefer a regular merge commit (not squash) to preserve the individual commits on the branch. Only squash if the branch has noisy "wip" commits that add no information.

---

## CI

Two independent workflows run on GitHub Actions.

### `tests` (backend)

- Triggered: every push to any branch; every PR; manual dispatch
- Python: 3.11 (pinned — matches the environment the metrics were measured in)
- Installs: `requirements.txt` + `requirements-advanced.txt` with PyTorch CPU wheels
- Command: `pytest -v`
- Data: `data/raw/uci_ckd.csv` is committed and available in CI

### `frontend`

- Triggered: pushes and PRs touching `ckd-frontend/**` or the workflow file itself
- Node: pinned via `ckd-frontend/.nvmrc`
- Gates in order: `tsc --noEmit`, `eslint --max-warnings=0`, `vitest run`, `vite build`
- The `--max-warnings=0` rule is intentional: a warning nobody fails on accumulates silently

### Re-triggering CI

Use the "Run workflow" button (workflow_dispatch) in the GitHub Actions UI. Never commit an empty or content-free change just to trigger CI — those commits stay in the history and signal to reviewers that CI was broken.

### What CI does not cover yet

- E2E tests (Playwright) — appropriate once the frontend is deployed
- Coverage reporting — the 475-test suite gives adequate signal without a coverage gate
- Dependabot — manual quarterly dependency review preferred at this project scale

---

## Secrets and environment variables

**No secret may ever appear in a committed file.**

This is not a "try to remember" rule. The gitignore enforces it:

- `ckd-frontend/.env.development` and `ckd-frontend/.env.production` are gitignored
- Use `ckd-frontend/.env.development.example` and `.env.production.example` as templates

Every `VITE_*` variable is inlined into the JavaScript bundle at build time and is readable by any browser. The architecture has no server tier. This means the frontend has zero capacity to hold secrets — by design, not by oversight.

If a backend deployment ever requires credentials (database URLs, service keys), they go into environment variables on the hosting platform, never in `.env` files committed to the repository.

---

## Documentation

### Authoritative documents

| Document | Authority |
|---|---|
| `README.md` | Project overview and quick start |
| `AUDIT.md` | Engineering audit findings and fixes |
| `MODEL_CARD.md` | Model performance, limitations, intended use |
| `FRONTEND_PLAN.md` | Frontend requirements (supersedes `docs/archive/frontend-spec/`) |
| `FRONTEND_ARCHITECTURE.md` | Frontend design, routes, data flow, ADRs |
| `FRONTEND_TEST_PLAN.md` | Frontend test matrix and CI specification |
| `data/README.md` | Data sourcing, licensing, how to add a dataset |
| `REPOSITORY_GOVERNANCE.md` | This file — development conventions |

### Rules for documentation

- If a number appears in a document, its source must be stated. Hardcoded metrics become lies when the pipeline changes. Use `scripts/make_model_card.py --check` to detect staleness.
- Do not duplicate information across documents. One document owns a fact; others reference it.
- When behaviour changes, update the documentation in the same PR.
- Historical documents (`AUDIT.md`, `docs/archive/`) are retained as-is. They are not updated to reflect current state — that is what the current-state documents are for.
- Superseded documents belong under `docs/archive/<topic>/` with a `README.md` stating what replaced them. Do not leave them where a reader could mistake them for current, and do not file them in hidden or tool-specific directories.

---

## Dependencies

### Python

- Direct dependencies are pinned with `==` in `requirements.txt` and `requirements-advanced.txt`
- Only direct dependencies are pinned, not the full transitive closure — a full lockfile would require `pip-compile` or `poetry`, which adds tooling complexity for marginal gain at this project scale
- When updating a dependency: test locally, update the pinned version, commit as `chore(deps): bump <package> <old> → <new>`

### Node / frontend

- Node version is pinned in `ckd-frontend/.nvmrc`
- `package-lock.json` is committed — `npm ci` enforces the exact tree
- `npm install` should only be run intentionally. CI uses `npm ci`.

---

## What is in main

`main` represents the project's current stable state. It should contain:

- All implemented Python source (`src/`, `api/`, `scripts/`, `config.py`)
- All tests (`tests/`)
- The public UCI CKD dataset (`data/raw/uci_ckd.csv`) — committed intentionally, CC BY 4.0
- All frontend source (`ckd-frontend/src/`)
- All documentation listed in the Authoritative documents table
- CI workflows (`.github/workflows/`)
- Sprint tags `sprint-0` through `sprint-6` on their original commits

---

## What never goes in main

- Real patient data — the gitignore blocks `data/raw/*` except the whitelisted UCI file
- Trained model binaries — `saved_models/` is gitignored and regenerable
- API keys, tokens, passwords, credentials of any kind
- `node_modules/` or Python virtual environments
- Generated reports when they can be regenerated by a script
- Content-free commits whose only purpose is to trigger CI
- Raw AI conversation transcripts or planning scratchpads

---

## Research integrity rules

These rules exist because this project reports measured numbers that could influence clinical decisions. Getting them wrong matters more than in most software projects.

1. **Never hardcode a metric.** Every accuracy, recall, specificity, AUC, or confidence interval in any document must be read from `saved_models/tabular_metrics.json` or measured at the time of writing with the method stated. `scripts/make_model_card.py --check` enforces this for `MODEL_CARD.md`.

2. **Label every result accurately.** Use the exact labels from the results table:
   - ✅ **VERIFIED** — measured by a clean run after all known bugs were fixed
   - ⚠️ **PROVISIONAL** — measured before a pipeline fix; will change when re-run
   - **SIMULATION** — the method is simulated (e.g. federated learning, synthetic pairing)
   - **PLANNED** — not yet implemented
   - **NOT VERIFIED** — claimed but not independently confirmed

3. **Comparisons must be model-for-model.** Comparing federated logistic regression against a centralized random forest measures the estimator change, not the federation cost. The correct comparison is the same model family trained both ways. AUDIT.md P1-9 documents the specific error that was made and fixed.

4. **Negative results are not hidden.** The multimodal fusion result (88.75%, below the 97.50% tabular baseline) is reported and its cause is diagnosed and documented. A future retrain that underperforms the current model does not overwrite the saved model (see `config.MIN_ACCEPTABLE_RECALL`).

5. **Confidence intervals are not decoration.** On 80 test rows, one misclassified patient moves accuracy by 1.25 points. A bare point estimate implies precision the sample cannot support. Every reported metric includes its Wilson 95% CI.

6. **The calibration caveat is always stated.** `p_ckd` is the fraction of trees voting for CKD, not a calibrated probability. 0.80 does not mean 80% of such patients have CKD. The agent and the frontend both state this every time they display the score.

---

*Governance document established 2026-09-04. Update this document via a `docs(repo)` PR when conventions change.*

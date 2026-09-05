# GitHub Repository Audit

**Repository:** https://github.com/Bereket18/ckd-detection
**Audit date:** 2026-09-04
**Audited by:** AI coding agent (Phase A — no changes applied)
**Audit scope:** Full repository state as found — GitHub, local working tree, all branches, CI, documentation, security, structure

---

## Contents

| Section | Topic |
|---|---|
| [1](#1-current-repository-state) | Current repository state |
| [2](#2-branch-inventory) | Branch inventory |
| [3](#3-branch-divergence-analysis) | Branch divergence analysis |
| [4](#4-ciworkflow-status) | CI / workflow status |
| [5](#5-red-x-diagnosis) | Red X diagnosis |
| [6](#6-documentation-problems) | Documentation problems |
| [7](#7-readme-assessment) | README assessment |
| [8](#8-git-history-problems) | Git history problems |
| [9](#9-repository-structure-problems) | Repository structure problems |
| [10](#10-security-concerns) | Security concerns |
| [11](#11-recommended-branch-strategy) | Recommended branch strategy |
| [12](#12-recommended-commit-strategy) | Recommended commit strategy |
| [13](#13-recommended-pr-strategy) | Recommended PR strategy |
| [14](#14-recommended-ci-strategy) | Recommended CI strategy |
| [15](#15-cleanup-candidates) | Cleanup candidates |
| [16](#16-risk-register-for-every-proposed-destructive-action) | Risk register |

---

## 1. Current Repository State

### Remote state (origin/main — what GitHub sees)

| Property | Value |
|---|---|
| Default branch | `main` |
| HEAD commit | `f71630d` — "re-trigger actions workflow" |
| Last real work commit | `8e9dbb7` — "test(pipeline): add unit and integration tests…" |
| Tags | `sprint-0` through `sprint-6` — all on `main` history |
| Open pull requests | 0 |
| Releases | 0 (tags exist but no GitHub Releases created from them) |
| Repository description | "Federated Multimodal Learning for Early Detection of Chronic Kidney Disease Using Clinical, Imaging, and Clinical Data." (note: "Clinical Data" appears twice in the description) |
| CI badge | `tests.yml` badge only — **red; see the correction in §4** |
| Frontend CI | `frontend.yml` is tracked on `chore/repo-governance`, not on `main`. It has run once and failed in 10s (§4). |
| `.github/workflows/` on main | `tests.yml` only |

### Local working tree state

| Property | Value |
|---|---|
| Current branch (HEAD) | `test/preprocessing-shap-pipeline` |
| Divergence from main | 6 commits ahead |
| Uncommitted changes | 40+ files with staged/unstaged modifications and deletions relative to the last commit on this branch |
| Untracked files | `FRONTEND_ARCHITECTURE.md`, `FRONTEND_TEST_PLAN.md`, `.github/workflows/frontend.yml`, many `ckd-frontend/src/` components, `github.md`, `node_modules/` (at root) |

The working tree is **in active mid-work state** on `test/preprocessing-shap-pipeline`. A substantial frontend implementation is underway — dozens of new components, routes, tests, and utility files exist untracked. This work has not been committed, let alone merged.

---

## 2. Branch Inventory

### Remote branches (on origin)

| Branch | Tip commit | Age | Status |
|---|---|---|---|
| `main` | `f71630d` | 2026-08-27 | Default branch, **CI red** (§5) |
| `feat/shap-explainability` | `b5c5a6f` | 2026-08-24 | 3 commits ahead of the base they diverged from; NOT merged to main |
| `test/preprocessing-shap-pipeline` | `65cf810` | 2026-08-27 | 6 commits ahead of main; NOT merged; large frontend + API work |

### Local-only branches (not on origin)

| Branch | Tip commit | Status |
|---|---|---|
| `my-experimental-feature` | `1781b9a` | 1 commit; local only; never pushed |

---

## 3. Branch Divergence Analysis

### `feat/shap-explainability` vs `main`

This branch diverged from `ca41bbd` — which is **2 commits before the current main tip**. The 3 unique commits on this branch are:

| Commit | Message | Content |
|---|---|---|
| `27dc15b` | `feat(explainability): implement SHAP explainability layer and tests` | Core SHAP work: `shap_utils.py`, tests, preprocessing refactor, `TabularPreprocessor` class, train script changes |
| `0149b15` | `feat(data): implement dataset ingestion layer and tests` | `datasets.py`, `DatasetSpec`, CI workflow (`tests.yml`), AUDIT.md, full README rebuild, pinned requirements, `dialogue_fsm.py`, `predict.py`, `make_model_card.py` |
| `b5c5a6f` | `feat(data): docs: update audit and README to reflect increased test coverage` | Minor AUDIT.md + README tweaks |

**Critical finding:** `main` commit `8e9dbb7` ("test(pipeline): add unit and integration tests…") added the same files (`tests.yml`, `AUDIT.md`, `datasets.py`, `shap_utils.py`, rebuilt README, pinned requirements) in a **single large commit directly to main**. This means the work from `feat/shap-explainability` was **cherry-picked or re-implemented directly on main** without ever merging the feature branch. The branch was not deleted afterwards. Result: the branch now represents **stale diverged history** — its functional content is superseded by `main`, but its own history is preserved on origin.

**Verdict:** `feat/shap-explainability` is not merged, not deletable via GitHub's "safe delete" (because it was never merged via PR), but its work is present on `main`. It is a **zombie branch** — exists on remote, has no pending work, has no open PR. It is safe to delete once this is confirmed, but requires explicit decision.

### `test/preprocessing-shap-pipeline` vs `main`

This branch diverged from `f71630d` — the current main tip. It is **6 commits ahead** of main:

| Commit | Message | Content |
|---|---|---|
| `12d6089` | `ci: force trigger actions workflow` | Accidental trigger commit |
| `31d1660` | `Add FastAPI backend and frontend foundation` | FastAPI app (`api/`), Pydantic schemas, the frontend specification documents (since archived at `docs/archive/frontend-spec/`), frontend TypeScript types |
| `f58a468` | `Add React app entry point and initial UI components` | `App.tsx`, `FormSection`, `NumericInput`, basic CSS, test stubs |
| `24e5c96` | `Document corrupted service files and update gitignore` | `CORRUPTED_FILES.md` (now deleted), gitignore changes |
| `5a7e8d2` | `Add clinical prediction service for API backend` | `src/services/clinical_prediction.py`, service layer |
| `65cf810` | `Add repository cleanup summary` | `REPOSITORY_CLEANUP.md` (documents what was committed and what was excluded) |

**Findings:**
- All 6 commit messages are non-conventional (imperative, no type prefix).
- This branch contains the **entire FastAPI backend** and early frontend foundation — real, functional work that is not on `main`.
- The working tree on this branch has an additional ~60+ untracked/modified files representing a substantially more advanced frontend implementation that was never committed to any branch.
- The branch name `test/preprocessing-shap-pipeline` does not describe its content accurately. The branch contains backend API and frontend UI work, not preprocessing or SHAP pipeline tests. The name was apparently chosen early and the branch repurposed.

### `my-experimental-feature` vs `main`

| Property | Value |
|---|---|
| Diverges from | `f71630d` (main tip) |
| Unique commits | 1: `1781b9a` — "Experimental changes without a branch" |
| Content | `MODEL_CARD.md` (184-line generated model card document), AUDIT.md additions (288 lines), README updates, `test_model_card.py` changes |
| Remote | Not pushed — local only |

**Finding:** This is a local-only branch with one commit that adds `MODEL_CARD.md` to the repository. The commit message acknowledges the branch was created after the work was done ("Experimental changes without a branch"). The content (MODEL_CARD.md) is referenced by `README.md` and `config.py`, and `scripts/make_model_card.py` is designed to generate it. This branch represents work that should be PR'd into main, not abandoned.

---

## 4. CI/Workflow Status

> **CORRECTED 2026-09-05.** The first version of this section reported "10 runs
> visible on GitHub; all complete without obvious failures" and a badge state of
> "Passing on `main`". Both were wrong, and §5 built a whole narrative on them.
> The run history was read from the Actions list without opening a single run's
> logs. What follows was measured with `gh run list --limit 100 --json
> conclusion,status,workflowName,headBranch` and by reading the failing job logs.

### `tests.yml` (backend pytest)

| Property | State |
|---|---|
| File location | `.github/workflows/tests.yml` (on `main`) |
| Trigger | Push to any branch; pull requests; `workflow_dispatch` |
| Python version | 3.11 (pinned) |
| Installs | `requirements.txt` + `requirements-advanced.txt` with PyTorch CPU index |
| Test command | `pytest -v` |
| Actual run history | **16 `tests` runs between 2026-08-24 and 2026-09-05. Before the fix on 2026-09-05: 14 `failure`, 1 `startup_failure`, 0 `success`.** |
| Actual badge state | **Red on `main`, and red on every branch. CI had never passed once.** |

The YAML itself is sound — Python is pinned, both requirements files are
installed, the CPU wheel index avoids the 2 GB CUDA build, and the committed UCI
CSV means data-dependent tests need no secrets. The failure was never in this
file. See §5.

### `frontend.yml` (TypeScript/Vitest/ESLint/build)

| Property | State |
|---|---|
| File location | `.github/workflows/frontend.yml`, tracked **only on `chore/repo-governance`** — not on `main` |
| GitHub status | **1 run, `failure`, 10 seconds.** Not "never executed" as first reported |
| Failure cause | `The specified node version file at: .../ckd-frontend/.nvmrc does not exist` — the workflow sets `node-version-file: ckd-frontend/.nvmrc`, but `.nvmrc` (`25.2.1`) is tracked on `test/preprocessing-shap-pipeline`, a different branch |
| Badge in README | Present in the rebuilt README on `chore/repo-governance`; absent from `main` |

Still a real gap: no frontend CI gates `main`. It resolves without editing the
workflow once both branches reach `main`, since the two halves — the workflow and
the `.nvmrc` it reads — are simply on different branches today.

---

## 5. Red X Diagnosis

**The red X was a real, reproducible test-suite failure — two of them — not a
badge or narrative problem.** The first version of this section concluded "there
is no current test failure; the tests themselves pass," and every one of its
three hypotheses (missing frontend badge, stale branches, non-conventional
commit messages) was cosmetic. None of them can turn a run red. That conclusion
was reached without opening a failing run's logs; opening them takes one command
and gives the answer immediately.

### Cause 1 — collection aborted: `ray` was never installed

From the logs of run 33885701034 (`test/preprocessing-shap-pipeline`) and
confirmed on `main`'s run 33063312020:

```
tests/test_federated.py:9: in <module>
    from src.federated.server import ...
src/federated/server.py:8: in <module>
    import ray
E   ModuleNotFoundError: No module named 'ray'
231 items collected / 1 error
!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!
exit code 2
```

A pytest **collection** error exits 2 and aborts the entire run, so not one of
the 231 collected tests executed. `requirements-advanced.txt` declared
`flwr==1.33.0`; `src/federated/server.py` imports `ray` at module scope because
`flwr.simulation` runs the simulated hospital clients on it. Bare `flwr` does not
depend on `ray` — the `simulation` extra does. It passed locally only because
`ray` was already present in the developer venv.

This is why the badge went red on 2026-08-24 and stayed red: every branch
inherits the same requirements file.

### Cause 2 — a genuinely failing test, hidden behind cause 1

`tests/test_model_card.py::test_changing_the_metrics_file_changes_the_card` fails
on a clean checkout of `main`, and has since 8e9dbb7 added it. Verified in a
throwaway `git worktree` on `origin/main`: `1 failed, 30 passed`. CI never
reported it because collection aborted first.

The card was right and the assertion was wrong: it required `"0.9750" not in
regenerated` after moving only the headline accuracy, but `0.9750` is also the
*sweep* accuracy at thresholds 0.50 and 0.70, which that change must not touch.

Fixing only cause 1 would have replaced one red X with a different one.

### Classification

| Question | Answer |
|---|---|
| Code failure? | No. `api/`, `src/`, and `scripts/` were correct throughout. |
| Test failure? | Yes — cause 2, one over-broad assertion. |
| Environment failure? | Yes — cause 1, a dependency present locally and absent in CI. |
| Workflow configuration failure? | Only for `frontend.yml` (`.nvmrc` on another branch). `tests.yml` is fine. |
| Branch-state problem? | No. |
| Stale workflow? | No. |
| Dependency problem? | Yes — cause 1, a missing extra, not a missing pin. |

### Resolution

PR [#1](https://github.com/Bereket18/ckd-detection/pull/1),
`fix/federated-ray-dependency`, one commit per cause:

- `4a93aa2` — `flwr[simulation]==1.33.0` in `requirements-advanced.txt`. The
  extra pins `ray==2.55.1` on Python 3.11, so `ray` is not listed separately.
- `86ce805` — the assertion scoped to the row it is about, which is stricter
  about location rather than weaker. `scripts/make_model_card.py` unchanged.

Run [33957189410](https://github.com/Bereket18/ckd-detection/actions/runs/33957189410):
**`242 passed in 8.75s`, job green in 1m34s — the first successful run in the
repository's history.** Nothing was skipped, xfailed, or relaxed.

---

## 6. Documentation Problems

### Root-level document sprawl

The repository root has **8 markdown documents** plus a `.txt` license file:

| File | Status |
|---|---|
| `README.md` | ✅ Authoritative, well-written, technically honest |
| `AUDIT.md` | ✅ Authoritative engineering audit — keep at root |
| `FRONTEND_PLAN.md` | ✅ Authoritative frontend requirements — untracked, needs committing |
| `FRONTEND_ARCHITECTURE.md` | ✅ Phase 1 architecture document — **untracked**, never committed |
| `FRONTEND_TEST_PLAN.md` | ✅ Phase 1 test specification — **untracked**, never committed |
| `FRONTEND_REQUIREMENTS_RECONCILIATION.md` | ✅ Requirements reconciliation — **partially untracked** (staged but not committed on current branch) |
| `clauket.md` | ❌ Raw AI planning conversation — not engineering documentation. Should not be committed to a professional repo |
| `github.md` | ❌ The governance spec prompt (this document's instructions). Not engineering documentation. Should not be committed |
| `License.txt` | ✅ MIT license — correct |

`clauket.md` is a raw assistant conversation transcript discussing grades, deadlines, and course rubrics. It is already committed to `main` (added in commit `8e9dbb7`). It should not be in a professional showcase repository. A stranger's first read of the repository would see this as a student planning document, immediately signalling "course project" rather than "serious engineering work."

`github.md` is this governance spec verbatim. It was never committed (untracked), which is correct.

### Duplicated/superseded documentation

The hidden `.kiro/specs/ckd-frontend/` directory contains `requirements.md`, `design.md`, `tasks.md`, and `tasks.meta.json` — which `FRONTEND_PLAN.md` explicitly supersedes. The spec files are tracked in git (committed on `test/preprocessing-shap-pipeline`). `FRONTEND_PLAN.md` itself documents the supersession.

Having both in the repo is acceptable if clearly labelled superseded, but that hidden directory also contains editor state (`.config.kiro`, `tasks.meta.json`) that serves no purpose for other contributors.

> **RESOLVED.** The three specification documents now live at `docs/archive/frontend-spec/` with a
> `README.md` explaining what they are and what replaced them; git recorded the move as a rename, so
> `git log --follow` still reaches `31d1660`. The two editor-state files were untracked with
> `git rm --cached` (they remain on disk) and the hidden directory is now ignored wholesale.

### Missing documentation

- No `CONTRIBUTING.md` or equivalent development guide for new contributors
- No `docs/` directory — all documentation is at root level *(partly resolved: `docs/archive/` now exists for superseded documents; current-state documents remain at root)*
- `data/README.md` exists and is good (dataset sourcing, ingestion steps)
- `MODEL_CARD.md` is on `my-experimental-feature` branch but has never reached `main`

---

## 7. README Assessment

The current `README.md` on `main` is **substantively strong** — it is one of the better research-project READMEs observed. Specific strengths:

- Results table with Wilson 95% confidence intervals
- Explicit ✅ / ⚠️ verification status per result
- Acknowledges the leakage bug fix and corrected numbers
- Explains the DFA formally, with the accepted language regex
- Distinguishes simulation from real results (federated, fusion)
- Honest about limitations (80 rows, synthetic pairing, uncalibrated probability)
- References `MODEL_CARD.md` — which does not exist on `main` yet

**Problems:**

| Problem | Detail |
|---|---|
| Single CI badge | Only the `tests.yml` badge, and it was red (§5). No frontend badge on `main`, because `frontend.yml` is tracked on `chore/repo-governance` |
| `MODEL_CARD.md` reference broken | README links to `MODEL_CARD.md` but the file is only on `my-experimental-feature`, not `main` |
| Description mentions it twice | Repository description says "Using Clinical, Imaging, and **Clinical** Data" — "Clinical" appears twice, "Text" is the missing third modality |
| "No web frontend" is now outdated | The README was written when the project was CLI-only. The project now has a FastAPI backend and a React frontend in progress. The README still says "No web frontend, no backend server deliberately" |
| Sprint-centric language | The project structure and narrative is still sprint-based. For a showcase repository, completed sprints should be described as implemented capabilities, not a work log |
| `clauket.md` reference | The file `clauket.md` is committed to `main` and linked nowhere, but appears in the file tree — a reviewer browsing the repo will click on it |

---

## 8. Git History Problems

### Non-conventional commits on `main`

| Commit | Message | Problem |
|---|---|---|
| `f71630d` | `re-trigger actions workflow` | Junk commit — content-free, purpose is to poke CI. Now the visible HEAD of `main` |
| `c791679` | `Update README to remove team information` | Non-conventional (`docs:` prefix missing) |
| `8e9dbb7` | `test(pipeline): add unit and integration tests for preprocessing, SHAP, and training` | Conventional prefix, but message undersells a 35-file, 8000-line commit that added CI, rebuilt the entire README, pinned all deps, added the full audit, and implemented `predict.py`, `make_model_card.py`, `datasets.py`, and the DFA. This is 5–8 logically separate changes in one commit. |

### Non-conventional commits on `test/preprocessing-shap-pipeline` (not yet on `main`)

All 6 commits on this branch use free-form messages with no Conventional Commits prefix:
- `Add repository cleanup summary`
- `Add clinical prediction service for API backend`
- `Document corrupted service files and update gitignore`
- `Add React app entry point and initial UI components`
- `Add FastAPI backend and frontend foundation`
- `ci: force trigger actions workflow` (this one has a prefix, but it's an accidental trigger commit — the content is trivial)

### Trigger commits

Two commits exist purely to trigger GitHub Actions:
- `f71630d` (on `main`): "re-trigger actions workflow"
- `12d6089` (on `test/preprocessing-shap-pipeline`): "ci: force trigger actions workflow"

These are visible in the commit history and signal to any reviewer that CI was broken or needed manual intervention. The correct fix (if CI needs re-triggering) is `workflow_dispatch` in the GitHub UI, not an empty commit.

### Missing PRs

Every commit on every feature branch was either pushed directly to `main` or left without a PR. No pull requests have ever been opened against this repository. The "professional PR workflow" phase of the project has never been exercised.

### Sprint tags vs release conventions

Tags `sprint-0` through `sprint-6` are lightweight git tags on `main`. They are not GitHub Releases. They document engineering milestones well but a non-contributor reviewer sees 7 tags with no descriptions in the GitHub Releases section, which GitHub displays as "0 releases."

---

## 9. Repository Structure Problems

### Root-level clutter

```
ckd-detection/
├── clauket.md          ← AI planning conversation, should not be here
├── github.md           ← governance spec (untracked, not committed — correct)
├── FRONTEND_ARCHITECTURE.md    ← untracked — should be committed or moved to docs/
├── FRONTEND_TEST_PLAN.md       ← untracked — same
├── FRONTEND_REQUIREMENTS_RECONCILIATION.md  ← partially staged
├── node_modules/       ← root-level node_modules from a stray Vite invocation
│   └── .vite/          ← Vite cache; not gitignored at root level; not tracked but present
```

### Root-level `node_modules`

There is a `node_modules/` directory at the project root containing only a `.vite/` cache subdirectory. This appeared from running `vite` or `npm install` at the root (there is no `package.json` at root). It is not tracked in git, but it is also **not covered by the root `.gitignore`**. The root `.gitignore` only ignores `ckd-frontend/node_modules/`, not `node_modules/` at root. If anyone were to run `git add .`, this directory would be staged.

### Editor spec directory in git

The hidden `.kiro/specs/ckd-frontend/` directory is committed to git on the `test/preprocessing-shap-pipeline` branch. This includes:
- `.config.kiro` — editor configuration file
- `tasks.meta.json` — editor task-tracking JSON
- `design.md`, `requirements.md`, `tasks.md` — spec files (superseded by `FRONTEND_PLAN.md`)

Editor-specific directories should typically be gitignored (analogous to `.idea/`, `.vscode/`). The spec documents have value as historical context, but the two state files have no value to other contributors.

> **RESOLVED.** Documents moved to `docs/archive/frontend-spec/`, state files untracked, hidden
> directory ignored. See §Duplicated/superseded documentation.

### Missing `docs/` organisation

All documentation lives at the root. As the project grows (especially with the frontend addition), this will become unwieldy. A minimal `docs/` structure would improve discoverability:
```
docs/
├── architecture.md    (could reference FRONTEND_ARCHITECTURE.md)
├── research.md        (or point to AUDIT.md sections)
├── api.md             (API overview)
└── development.md     (contributor setup guide)
```

This is a forward recommendation, not an immediate blocker.

### Backend `api/` vs `src/` co-location

The project has two Python package trees at root: `src/` (ML pipeline, agent, services) and `api/` (FastAPI routes and schemas). Both are on `test/preprocessing-shap-pipeline` but `api/` has never been merged to `main`. The separation is clean and intentional, but until merged, the backend is split across two branch realities.

---

## 10. Security Concerns

### MEDIUM: `/model` API exposes absolute filesystem paths

**Location:** `src/services/clinical_prediction.py` lines 87–93

```python
artifact_metadata = {
    name: {
        "path": str(path),   # ← absolute path, e.g. /home/ubuntu/ckd-detection/saved_models/...
        "sha256": _sha256(path),
    }
    for name, path in paths.items()
    if path.exists()
}
```

The `model_metadata()` method returns this dict verbatim through the `/model` endpoint. Any browser or API caller receives the full absolute filesystem path of every model artifact. `FRONTEND_PLAN.md` identifies this problem explicitly (Rule 11: "never render a server-supplied filesystem path, anywhere") and the frontend architecture adds a path filter on the client side. The **server-side fix is not yet implemented** — the path is still emitted by the backend.

**Risk level:** MEDIUM. In a production deployment this leaks server directory layout to any caller. Locally it is benign.

**Fix required:** Strip or redact `artifacts[*].path` from `model_metadata()` before returning it to callers, replacing it with a relative or sanitised identifier. Do not fix this silently as a side effect of another change — it warrants its own commit with a clear message.

### LOW: `ckd-frontend/.env.development` is tracked in git

`ckd-frontend/.env.development` is a committed file on the `test/preprocessing-shap-pipeline` branch (also on `origin/test/preprocessing-shap-pipeline`). Its content is:
```
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT=30000
VITE_HEALTH_CHECK_INTERVAL=60000
```

**There are no secrets in this file.** All three values are public configuration. However, `.env.*` files are conventionally gitignored and the file comment itself states *"no secret, token, key, or password may ever appear here."* The correct pattern is to commit a `.env.example` or `.env.development.example` showing the shape without values, and gitignore the real file.

The root `.gitignore` already ignores `.env` at root. The `ckd-frontend/.gitignore` only ignores `.env.local` and `.env.*.local` — it does not cover `.env.development`. This is the gap that allowed the tracked commit.

**Risk level:** LOW currently (no secrets present). MEDIUM for the future if a developer adds a real key to this file, not realising it is tracked.

### LOW: Root-level `node_modules/` not gitignored

A `node_modules/` directory exists at the repo root (left by a stray Vite invocation). The root `.gitignore` only covers `ckd-frontend/node_modules/`. If anyone ran `git add .` at the root, this directory would be staged and potentially committed. With only a `.vite/` cache subdirectory this is low risk today, but the gap should be closed.

### LOW: `my-experimental-feature` local-only branch never pushed

`my-experimental-feature` (1781b9a) exists only locally. It contains `MODEL_CARD.md` and substantial AUDIT.md updates. If the local machine is lost, this work is gone. It should be pushed and PR'd promptly.

### NO FINDING: `ckd-frontend/.env.production` not tracked

`.env.production` exists on disk but is not tracked in git on any branch. It also contains only public config (same URL and timeout pattern as `.env.development`). This is correct behaviour.

### NO FINDING: No credentials, tokens, or API keys anywhere

A full search of all Python source files and tracked markdown files found no API keys, bearer tokens, passwords, or credentials. The `fake_team_email` `team@ethiockd-agent.local` in git author metadata is a placeholder, not a real credential.

---

## 11. Recommended Branch Strategy

### Proposed going forward

```
main
  └─ always stable; CI must pass before any merge
  └─ no direct development commits after this point

feat/<description>        feature work
fix/<description>         bug fixes
docs/<description>        documentation only
refactor/<description>    internal restructuring
test/<description>        test additions/corrections (NOT used for backend + frontend work as now)
ci/<description>          workflow changes
chore/<description>       dependency bumps, gitignore updates, tooling
research/<description>    experimental/exploratory work that may not merge
```

### What to do with each existing branch

> **CORRECTED 2026-09-05** on two rows. `feat/shap-explainability` and
> `my-experimental-feature` were both assessed by diffing trees, not by reading
> branch names or dates. The `my-experimental-feature` row was wrong.

| Branch | Recommendation | Reason | Destructive? |
|---|---|---|---|
| `main` | Keep; protect | Default, stable branch | No |
| `fix/federated-ray-dependency` | Merge via PR [#1](https://github.com/Bereket18/ckd-detection/pull/1), then delete | The two CI fixes of §5. Green: run 33957189410, 242 passed. | No (a merged branch's content is in `main` by definition) |
| `feat/shap-explainability` | **Do not merge. Retain, or delete only on your explicit say-so** | Diffed against `main`: **83 insertions, 3358 deletions.** Its "additions" are the *pre-refactor* `chatbot.py`; `src/explain/shap_utils.py` and `tests/test_shap_utils.py` are byte-identical to `main`. Merging it would **regress `main`**. Nothing unique would be lost by deleting it, but nothing is gained either — it costs nothing to keep as history. | **YES to delete — see §16** |
| `test/preprocessing-shap-pipeline` | **Open a PR to `main`** | Real unmerged work: the FastAPI backend (`api/`), `src/services/`, and the full frontend product surface. The branch name understates it; rename in a fresh branch if desired. | No |
| `feat/model-card` | **Open a PR to `main`** | `MODEL_CARD.md` and the audit additions that `README.md` already links to. | No |
| `my-experimental-feature` (local only) | **Nothing to push. Delete only on your explicit say-so** | ~~Push to origin; open PR~~ — wrong. Its tree is **identical** to `origin/feat/model-card` (`git diff` between them is empty), so it is a duplicate carrying the non-conventional message *"Experimental changes without a branch"*. There is no data-loss risk and no unique work: once `feat/model-card` merges, every byte is on `main`. | **YES to delete — see §16** |

---

## 12. Recommended Commit Strategy

### For new commits, strictly enforce Conventional Commits:

```
<type>(<scope>): <imperative description>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `style`, `revert`

Useful scopes for this project: `api`, `frontend`, `model`, `pipeline`, `agent`, `ci`, `docs`, `data`, `repo`

**Examples:**

```
feat(api): add /predict/batch endpoint with CSV and JSON support
fix(api): redact filesystem paths from /model artifact metadata
docs(readme): rebuild project README as engineering showcase
ci(frontend): add TypeScript, ESLint, Vitest, and build workflow
chore(gitignore): ignore root node_modules and editor state directories
refactor(agent): extract dialogue FSM from chatbot loop
test(pipeline): add preprocessing leakage regression test
```

### For existing history

Do **not** rewrite any published history. The sprint-based commit messages in `main`'s early history are honest and legible. The problem commits (`re-trigger actions workflow`, `Update README to remove team information`) are already published on `main`. They should be documented here but not rewritten.

### Prevent future trigger commits

Use `workflow_dispatch` (the "Run workflow" button in GitHub Actions UI) to re-trigger CI. Never commit a content-free change as a CI trigger. The `tests.yml` workflow already includes `workflow_dispatch` — use it.

---

## 13. Recommended PR Strategy

### Template (to be added as `.github/pull_request_template.md`)

```markdown
## Summary
<!-- What changed? -->

## Why
<!-- Why was this change necessary? -->

## Implementation
<!-- How was it done? Key decisions. -->

## Validation
<!-- What was tested? CI results? Manual testing? -->

## Risks
<!-- What could break? What was deferred? -->

## Checklist
- [ ] CI passes
- [ ] No secrets committed
- [ ] Commit messages follow Conventional Commits
- [ ] Documentation updated if behaviour changed
```

### Immediate PRs needed

1. **`feat/api-and-frontend-foundation`** (from current `test/preprocessing-shap-pipeline` work): FastAPI backend + service layer + frontend foundation → `main`
2. **`feat/model-card`** (from `my-experimental-feature`): `MODEL_CARD.md` + AUDIT additions → `main`
3. **`chore/repository-governance`**: `.gitignore` fixes, remove `clauket.md`, add PR template, push `frontend.yml` → `main`

### Workflow for all future work

```
git checkout main && git pull
git checkout -b feat/my-feature
# implement + test
git add <specific files>
git commit -m "feat(scope): description"
git push -u origin feat/my-feature
# open PR on GitHub with description
# CI passes → merge → delete branch
```

---

## 14. Recommended CI Strategy

### Backend (`tests.yml`) — current state is good

The `tests.yml` YAML is well-designed and needs no changes. It was red for 12
days, but the cause was in `requirements-advanced.txt` and one test assertion,
not in the workflow (§5). It is green as of run 33957189410. The only
improvement is making it the required gate for all PRs (branch protection, §16).

One live annotation to address: `actions/checkout@v4` and
`actions/setup-python@v5` are being forced onto Node 24 because Node 20 is
deprecated on the runners. Bump to `@v5` / `@v6`.

### Frontend (`frontend.yml`) — must be pushed

`frontend.yml` exists locally and is well-designed (TypeScript check, ESLint at `--max-warnings=0`, Vitest, build). It must be pushed to `origin/main` to activate. Until it is pushed, **no frontend code is gated by any CI on GitHub**.

The frontend workflow uses path filters (`ckd-frontend/**`) which is correct — backend and frontend CI are independent and should not re-run each other's checks.

### What the full CI picture should look like

```
On push to any branch:
  backend: tests.yml   (Python 3.11, pytest)

On push touching ckd-frontend/**:
  frontend: frontend.yml  (Node 22, tsc, eslint, vitest, vite build)

On PR to main:
  Both workflows required to pass before merge (branch protection)
```

### What to skip (not justified for this project size)

- Coverage reporting (Codecov or similar) — adds complexity; the existing 134 tests give adequate signal
- Dependabot auto-PRs — creates noise; manual quarterly dependency review is sufficient
- SAST scanning — no user-supplied input reaches filesystem; no SQL; marginal value at this scale
- E2E tests (Playwright/Cypress) — appropriate once the frontend is deployed somewhere stable
- Docker build in CI — not needed unless the project moves toward deployment

---

## 15. Cleanup Candidates

### Files/directories to remove (with evidence and risk level)

| Item | Location | Reason | Risk |
|---|---|---|---|
| `clauket.md` | Root (tracked on `main`) | Raw AI planning conversation referencing grades, deadlines, course rubric. Not engineering documentation. Visible to any visitor. | LOW — delete and commit as `chore(repo): remove AI planning scratch file` |
| Root `node_modules/` | Root (untracked, not gitignored) | Stale Vite cache from a root-level npm invocation. No `package.json` at root. | NONE — safe to delete; add `node_modules/` to root `.gitignore` |
| `ckd-frontend/CORRUPTED_FILES.md` | `test/preprocessing-shap-pipeline` (deleted in working tree) | Temporary note about incomplete files during automated creation. No longer relevant. Already deleted locally. | NONE — confirm deletion and commit |
| `ckd-frontend/STATUS.md` | `test/preprocessing-shap-pipeline` (deleted in working tree) | Temporary status file. Already deleted locally. | NONE |
| `ckd-frontend/src/App.tsx`, `App.css` | `test/preprocessing-shap-pipeline` (deleted in working tree, replaced by proper architecture) | Superseded by the proper component-based structure in the current untracked working tree | LOW — confirm replacement exists before committing deletion |
| `ckd-frontend/src/assets/react.svg`, `vite.svg`, `hero.png` | `test/preprocessing-shap-pipeline` (deleted in working tree) | Default Vite scaffold assets not used in the actual app | NONE |
| `.config.kiro` (editor config, in the hidden spec directory) | `test/preprocessing-shap-pipeline` (tracked) | Editor state with no value to contributors | DONE — untracked, still on disk |
| `tasks.meta.json` (editor task state, same directory) | `test/preprocessing-shap-pipeline` (tracked) | Editor task tracking; changes on every task state change; creates noisy commits | DONE — untracked and ignored |
| `github.md` | Root (untracked) | The governance spec prompt — not engineering documentation | NONE (not tracked; just delete locally) |

### Things that look like cleanup candidates but are NOT

| Item | Why to keep |
|---|---|
| `AUDIT.md` | Authoritative engineering record; referenced throughout the codebase; genuine provenance value |
| `clauket.md` sprint history section | Wait — `clauket.md` as a whole should go; the audit findings it summarises are in `AUDIT.md` |
| `docs/archive/frontend-spec/requirements.md`, `design.md`, `tasks.md` | Historical documentation of the spec process; `FRONTEND_PLAN.md` notes they are retained. Keep but ensure they are clearly marked superseded |
| Sprint tags (`sprint-0` to `sprint-6`) | Engineering history; do not delete |
| `notebooks/` | EDA provenance; do not delete |
| `data/raw/uci_ckd.csv` | Public, CC BY 4.0 dataset committed intentionally; do not delete |
| `my-experimental-feature` branch | Contains `MODEL_CARD.md` — valuable unreleased work; do not delete until merged |

---

## 16. Risk Register for Every Proposed Destructive Action

| Action | Reversible? | Risk level | Pre-condition before proceeding |
|---|---|---|---|
| Delete `clauket.md` from `main` (tracked file) | Yes — git history preserves it | **LOW** | None. Clear improvement with no information loss. |
| Delete `feat/shap-explainability` branch from origin | **Partially** — commits are reachable from main; branch pointer is gone | **LOW-MEDIUM** | Confirm with `git diff main feat/shap-explainability --stat` that no unique content exists. The 3-line diff on non-shared files should be zero. Do NOT delete until this is verified. |
| Delete `test/preprocessing-shap-pipeline` branch from origin | Yes — only after PR is merged to main | **HIGH if done before merging** | PR must be opened, CI must pass, PR must be merged, then branch can be safely deleted. Do not delete before merge. |
| Delete `my-experimental-feature` local branch | Yes — after pushing to origin and opening PR | **HIGH if done before merging** | Branch must be pushed to origin first. |
| Untrack the hidden editor spec directory (gitignore + `git rm --cached`), keeping the documents at `docs/archive/frontend-spec/` | Yes — files stay on disk; only removed from git index | **LOW** | DONE. The three spec documents were moved with `git mv` (rename recorded, history preserved) and only the two editor-state files were untracked. |
| Fix `ckd-frontend/.gitignore` to cover `.env.development` | Yes | **NONE** | The file has no secrets; fix is additive (ignore more things). |
| Add root-level `node_modules/` to root `.gitignore` | Yes | **NONE** | Additive change only. |
| Strip `artifacts[*].path` from `/model` API response | Backend behavior change | **MEDIUM** | Must be done as an explicit commit with tests updated. Frontend architecture already anticipates this. Do not do silently. |
| Rewrite history of `main` | **NO — never** | **CRITICAL** | History safety rule: published history is immutable. Document inconsistencies; move forward. |
| Force-push any branch | **NO — never** | **CRITICAL** | Only exception: `my-experimental-feature` is local-only and has never been pushed; no force-push needed there either. |

---

## Summary: Prioritised Action List

This section orders the proposed changes by impact and dependency, for use when proceeding with subsequent phases.

### Immediate (no risk, unblock everything)

1. Push `my-experimental-feature` to `origin` to prevent work loss
2. Add `node_modules/` to root `.gitignore`
3. Add `.env.development` and `.env.production` to `ckd-frontend/.gitignore`
4. Push `frontend.yml` to `main` (it exists locally; just needs a commit and push)

### Short-term (after CI is confirmed green)

5. Open PR from `test/preprocessing-shap-pipeline` → `main` (after renaming or rebasing to clean up commit messages)
6. Open PR from `my-experimental-feature` → `main` (for `MODEL_CARD.md`)
7. Remove `clauket.md` via a `chore(repo)` commit on a branch + PR
8. Fix the `/model` API path exposure in a `fix(api)` PR
9. Add `.github/pull_request_template.md`

### Medium-term (repository polish)

10. Create GitHub Releases from existing sprint tags with descriptions
11. Add `REPOSITORY_GOVERNANCE.md` with forward conventions
12. Fix repository description (remove duplicate "Clinical")
13. Update README to reflect new architecture (FastAPI backend + React frontend exist)
14. Consider `docs/` directory for FRONTEND_ARCHITECTURE, FRONTEND_TEST_PLAN

### Do not do

- Rewrite any published commit history
- Delete `feat/shap-explainability` without first verifying its unique content is zero
- Enable branch protection rules that require a review — this is a solo project; requiring self-review on PRs adds friction without safety benefit
- Add enterprise CI features (Dependabot, Codecov, SAST) that create noise at this project scale

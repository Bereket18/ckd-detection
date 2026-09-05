# Archived — original frontend specification

Historical record. **Nothing here is authoritative and nothing should be implemented from it.**

These three documents were the first specification written for the CKD web frontend, produced
through an IDE-assisted spec workflow before any frontend code existed. They described a narrow
desktop tool for clinicians: one long form holding all 24 clinical fields, a CSV batch upload, and
a result screen showing the model score as a percentage.

The product that was actually built is different, and deliberately so. It is patient-facing,
mobile-first from 320 px, walks the user through the assessment in guided steps, treats missing
data as a first-class answer rather than an error, and never presents the model score as a
calibrated probability — because the backend itself states it is not one.

| | This archive | What replaced it |
|---|---|---|
| Requirements | `requirements.md` — 10 requirements, 70 acceptance criteria | [FRONTEND_PLAN.md](../../../FRONTEND_PLAN.md) |
| Design | `design.md` — tabbed single page, React 18, hand-written CSS | [FRONTEND_ARCHITECTURE.md](../../../FRONTEND_ARCHITECTURE.md) |
| Tasks | `tasks.md` — 91 tasks, 11 completed | superseded; not scheduled |

Roughly 45 of the 70 acceptance criteria were verified against the live backend and carried
forward — the 24 field ranges and enums, the error taxonomy, the SHAP presentation rules, the
accessibility floor. Nine were rejected because the backend contradicts them or has no data to
satisfy them. One requirement (CSV batch upload) moved to the Research Lab area. Every decision is
recorded, requirement by requirement, in
[FRONTEND_REQUIREMENTS_RECONCILIATION.md](../../../FRONTEND_REQUIREMENTS_RECONCILIATION.md).

## Why these files moved here

They previously lived in `.kiro/specs/ckd-frontend/`, a hidden directory belonging to the IDE that
generated them. That location made real project documentation invisible to anyone browsing the
repository and mixed it with machine-written editor state. The documents are worth keeping, so they
moved to `docs/archive/`; the two IDE state files that sat beside them (`.config.kiro` and
`tasks.meta.json`) are no longer tracked in git and `.kiro/` is now ignored entirely. Git history
for all three documents is preserved across the move — `git log --follow` on any of them reaches
back to the original commit.

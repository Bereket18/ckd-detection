## Summary

What changed?

## Why

Why was this change necessary?

## Implementation

How was it done? Key decisions made.

## Validation

What was tested? CI results, manual testing, or local verification.

## Risks

What could be affected? Anything intentionally deferred?

---

**Checklist**

- [ ] CI passes (backend `tests` + `frontend` if touching `ckd-frontend/`)
- [ ] No secrets committed (no API keys, tokens, or credentials in any file)
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] Documentation updated if behaviour changed
- [ ] No hardcoded metrics or model results (all figures come from `saved_models/tabular_metrics.json`)

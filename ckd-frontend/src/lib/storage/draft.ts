/**
 * Assessment draft storage — the only patient data written anywhere.
 *
 * `sessionStorage`, one key, nothing else. It closes with the tab, is not shared
 * between tabs, and is cleared on submit-and-navigate-away, on *Start over*, and
 * on entering or leaving demo mode (architecture §8.5).
 *
 * `localStorage` is used for nothing at all, anywhere in the product — not a
 * theme, not a dismissal flag (ADR-10). The rule "no patient data in
 * localStorage" erodes the moment something innocuous lives there, so the API is
 * simply never touched, and a test asserts the string does not appear in `src/`.
 *
 * Deliberately narrow: no metadata, no timestamps, no identifiers, no schema
 * knowledge. The field names come from `/model.feature_schema` at the call site,
 * so this module cannot hardcode the 24-field schema even by accident.
 */

/** One key. A second key would be a second lifecycle to reason about. */
export const DRAFT_KEY = 'ethiockd.assessment.draft';

/** What a field may hold: a number, a categorical string, or "not provided". */
export type DraftValue = string | number | null;
export type Draft = Record<string, DraftValue>;

/**
 * `sessionStorage` throws rather than returning null in a few real situations —
 * Safari private browsing, a storage-disabled enterprise profile, a quota
 * ceiling. A draft is a convenience, so every operation degrades to a no-op
 * instead of taking down the assessment.
 */
function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function isDraftValue(value: unknown): value is DraftValue {
  return value === null || typeof value === 'string' || typeof value === 'number';
}

/**
 * Read the draft with no schema knowledge at all: every primitive-valued key that
 * is on disk, or `null`.
 *
 * Exists for one caller — the assessment form's initial state, which is created
 * before `/model` has answered and therefore has no field list to filter against.
 * That is safe because filtering happens on every path *out* of the form state:
 * the request payload is built from `feature_schema`, and {@link writeDraft} drops
 * unknown keys on the way back to disk. A key the model no longer accepts can sit
 * inertly in form state; it cannot reach the API.
 */
export function readDraftRaw(): Draft | null {
  const store = storage();
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearDraft();
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    clearDraft();
    return null;
  }

  const draft: Draft = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isDraftValue(value)) draft[key] = value;
  }
  return Object.keys(draft).length > 0 ? draft : null;
}

/**
 * Read the draft, keeping only keys in `allowedKeys` — the field list from
 * `/model.feature_schema`.
 *
 * Filtering on read rather than trusting what is on disk matters: a draft
 * written before a backend schema change would otherwise reintroduce a field the
 * model no longer accepts, and the request would fail with `extra_forbidden`.
 */
export function readDraft(allowedKeys: readonly string[]): Draft | null {
  const raw = readDraftRaw();
  if (raw === null) return null;

  const allowed = new Set(allowedKeys);
  const draft: Draft = {};
  for (const [key, value] of Object.entries(raw)) {
    if (allowed.has(key)) draft[key] = value;
  }
  return Object.keys(draft).length > 0 ? draft : null;
}


/** Write the draft, keeping only known keys and primitive values. */
export function writeDraft(draft: Draft, allowedKeys: readonly string[]): void {
  const store = storage();
  if (!store) return;

  const allowed = new Set(allowedKeys);
  const clean: Draft = {};
  for (const [key, value] of Object.entries(draft)) {
    if (allowed.has(key) && isDraftValue(value)) clean[key] = value;
  }

  // Nothing usable survived — the user cleared their last answer, or the schema
  // no longer names any of these fields. Remove the key rather than storing `{}`,
  // which `hasDraft` would report as resumable and `readDraft` would then answer
  // with null: a *Resume* affordance that resumes nothing.
  if (Object.keys(clean).length === 0) {
    clearDraft();
    return;
  }

  try {
    store.setItem(DRAFT_KEY, JSON.stringify(clean));
  } catch {
    // Quota or a disabled store. The form keeps working from memory.
  }
}

/** Remove the draft. Safe to call when none exists. */
export function clearDraft(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to do */
  }
}

/** `true` when a resumable draft exists — used by the `/results` empty state. */
export function hasDraft(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    return store.getItem(DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Debounced writer. Typing a three-digit blood-pressure value should not write
 * three times; 500 ms is long enough to coalesce a keystroke run and short
 * enough that an accidental tab close rarely loses an answer.
 */
export function createDraftWriter(
  allowedKeys: readonly string[],
  delayMs = 500
): { write: (draft: Draft) => void; flush: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Draft | null = null;

  const commit = () => {
    if (pending !== null) writeDraft(pending, allowedKeys);
    pending = null;
    timer = null;
  };

  return {
    write(draft) {
      pending = draft;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(commit, delayMs);
    },
    flush() {
      if (timer !== null) clearTimeout(timer);
      commit();
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

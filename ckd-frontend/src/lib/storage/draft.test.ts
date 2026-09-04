import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT_KEY,
  clearDraft,
  createDraftWriter,
  hasDraft,
  readDraft,
  writeDraft,
  type Draft,
} from './draft';

/**
 * The draft helper is the only code in the product that writes patient data
 * anywhere, so its guarantees are worth pinning down precisely.
 *
 * Three of them carry real risk:
 *
 * 1. **Key filtering happens on read as well as on write.** A draft written before
 *    a backend schema change would otherwise reintroduce a field the model no
 *    longer accepts, and `/predict` rejects unknown fields with `extra_forbidden` —
 *    a submission failure with no visible cause.
 * 2. **A corrupt value removes itself.** Left in place it fails every subsequent
 *    read for the life of the tab.
 * 3. **Every operation degrades to a no-op when the store throws.** Safari private
 *    browsing and quota ceilings both throw; a lost draft is a nuisance, a thrown
 *    exception in the middle of the assessment is not.
 *
 * `tests/setup.ts` clears `sessionStorage` after each test, so no test here has to.
 * The debounce tests own a fake clock and drive it explicitly — there is no `waitFor`
 * in this file, for the reason documented in `Tooltip.test.tsx`.
 */

const FIELDS = ['age', 'bp', 'sg', 'rbc'] as const;

afterEach(() => {
  // Before the global `afterEach` in `tests/setup.ts`, which calls
  // `sessionStorage.clear()` — on a hostile stub that would throw.
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readDraft / writeDraft', () => {
  it('round-trips the values it was given', () => {
    writeDraft({ age: 45, bp: 80, rbc: 'normal', sg: null }, FIELDS);
    expect(readDraft(FIELDS)).toEqual({ age: 45, bp: 80, rbc: 'normal', sg: null });
  });

  it('returns null when nothing has been written', () => {
    expect(readDraft(FIELDS)).toBeNull();
  });

  it('drops keys the schema does not name, on the way in', () => {
    // `patient_name` is the shape of the mistake this guards against: a field that
    // is not in `/model.feature_schema` and must never reach the request body.
    writeDraft({ age: 45, patient_name: 'A. Person' } as Draft, FIELDS);
    expect(readDraft(FIELDS)).toEqual({ age: 45 });
  });

  it('drops keys the schema no longer names, on the way out', () => {
    // Written while `sg` was part of the schema, read after it was removed.
    writeDraft({ age: 45, sg: 1.02 }, FIELDS);
    expect(readDraft(['age', 'bp'])).toEqual({ age: 45 });
  });

  it('keeps only numbers, strings and null', () => {
    writeDraft(
      { age: 45, bp: true, sg: { nested: 1 }, rbc: undefined } as unknown as Draft,
      FIELDS
    );
    // A boolean, an object and `undefined` are all rejected: the form's three real
    // states are a number, a categorical string, and "not provided" (null).
    expect(readDraft(FIELDS)).toEqual({ age: 45 });
  });

  it('returns null rather than an empty object when everything was filtered out', () => {
    writeDraft({ unknown_field: 1 } as Draft, FIELDS);
    expect(readDraft(FIELDS)).toBeNull();
  });

  it('removes a corrupt value instead of failing every later read', () => {
    sessionStorage.setItem(DRAFT_KEY, '{ not json');
    expect(readDraft(FIELDS)).toBeNull();
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it.each([
    ['an array', '[1, 2, 3]'],
    ['a bare string', '"age"'],
    ['a number', '42'],
    ['null', 'null'],
  ])('rejects and removes %s, which is valid JSON but not a draft', (_label, raw) => {
    sessionStorage.setItem(DRAFT_KEY, raw);
    expect(readDraft(FIELDS)).toBeNull();
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('writes exactly one key, so there is one lifecycle to reason about', () => {
    writeDraft({ age: 45, bp: 80 }, FIELDS);
    expect(Object.keys(sessionStorage)).toEqual([DRAFT_KEY]);
  });

  it('replaces the stored draft rather than merging into it', () => {
    writeDraft({ age: 45, bp: 80 }, FIELDS);
    writeDraft({ age: 46 }, FIELDS);
    // The caller owns the whole draft; a merge here would resurrect a value the
    // user had just cleared.
    expect(readDraft(FIELDS)).toEqual({ age: 46 });
  });
});

describe('clearDraft / hasDraft', () => {
  it('reports whether a resumable draft exists', () => {
    expect(hasDraft()).toBe(false);
    writeDraft({ age: 45 }, FIELDS);
    expect(hasDraft()).toBe(true);
    clearDraft();
    expect(hasDraft()).toBe(false);
  });

  it('is safe to clear when there is nothing to clear', () => {
    expect(() => clearDraft()).not.toThrow();
  });

  it('agrees with readDraft when nothing survived filtering', () => {
    // `hasDraft` gates the *Resume* affordance, so it must not answer true where
    // `readDraft` would then return null — that offers a resume that resumes
    // nothing. A write with no usable values removes the key instead of storing
    // an empty object.
    writeDraft({ unknown_field: 1 } as Draft, FIELDS);
    expect(readDraft(FIELDS)).toBeNull();
    expect(hasDraft()).toBe(false);
  });

  it('removes the key when the user clears the last remaining answer', () => {
    writeDraft({ age: 45 }, FIELDS);
    expect(hasDraft()).toBe(true);
    writeDraft({}, FIELDS);
    expect(hasDraft()).toBe(false);
  });
});

/**
 * The clock is owned outright here, and every advance is explicit. Nothing in this
 * block awaits anything, so there is no chance of the frozen-clock deadlock that
 * `waitFor` and `user-event` both produce against fake timers.
 */
describe('createDraftWriter', () => {
  it('coalesces a run of keystrokes into one write', () => {
    vi.useFakeTimers();
    try {
      const writer = createDraftWriter(FIELDS, 500);

      writer.write({ age: 1 });
      writer.write({ age: 12 });
      writer.write({ age: 120 });
      // Nothing yet: a three-digit blood-pressure entry should cost one write.
      expect(hasDraft()).toBe(false);

      vi.advanceTimersByTime(499);
      expect(hasDraft()).toBe(false);

      vi.advanceTimersByTime(1);
      expect(readDraft(FIELDS)).toEqual({ age: 120 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts the delay on each keystroke rather than writing on a fixed cadence', () => {
    vi.useFakeTimers();
    try {
      const writer = createDraftWriter(FIELDS, 500);

      writer.write({ age: 1 });
      vi.advanceTimersByTime(400);
      writer.write({ age: 12 });
      vi.advanceTimersByTime(400);
      // 800 ms of typing, still nothing written: the user has not paused.
      expect(hasDraft()).toBe(false);

      vi.advanceTimersByTime(100);
      expect(readDraft(FIELDS)).toEqual({ age: 12 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes on demand, for the navigate-away case', () => {
    vi.useFakeTimers();
    try {
      const writer = createDraftWriter(FIELDS, 500);

      writer.write({ age: 45 });
      writer.flush();
      expect(readDraft(FIELDS)).toEqual({ age: 45 });

      // The pending timer went with it: no second write when the clock catches up.
      clearDraft();
      vi.advanceTimersByTime(2000);
      expect(hasDraft()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is a no-op to flush with nothing pending', () => {
    vi.useFakeTimers();
    try {
      const writer = createDraftWriter(FIELDS, 500);
      writer.flush();
      expect(hasDraft()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('discards the pending write on cancel, so *Start over* leaves nothing behind', () => {
    vi.useFakeTimers();
    try {
      const writer = createDraftWriter(FIELDS, 500);

      writer.write({ age: 45 });
      writer.cancel();
      vi.advanceTimersByTime(2000);

      // A write landing after *Start over* would restore data the user deleted.
      expect(hasDraft()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves no timer behind once it has written', () => {
    vi.useFakeTimers();
    try {
      const writer = createDraftWriter(FIELDS, 500);
      writer.write({ age: 45 });
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(500);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies the same key filtering as a direct write', () => {
    vi.useFakeTimers();
    try {
      const writer = createDraftWriter(FIELDS, 500);
      writer.write({ age: 45, patient_name: 'A. Person' } as Draft);
      writer.flush();
      expect(readDraft(FIELDS)).toEqual({ age: 45 });
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Safari private browsing throws on `setItem`. A storage-disabled enterprise
 * profile throws on `getItem`. A long session can hit the quota ceiling. In all
 * three the draft is lost — which is a nuisance — and the assessment must keep
 * working, which is not negotiable.
 *
 * The global is replaced rather than `Storage.prototype` patched: jsdom hands out
 * `sessionStorage` through a proxy that resolves its own methods, so a spy on the
 * prototype never runs and the test would pass without exercising anything.
 */
describe('when the store throws', () => {
  /** A store whose every operation fails, as a disabled profile behaves. */
  function hostileStore(): Storage {
    const fail = (): never => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    };
    return {
      get length(): number {
        return fail();
      },
      clear: fail,
      getItem: fail,
      key: fail,
      removeItem: fail,
      setItem: fail,
    };
  }

  it('reads as absent when the read fails', () => {
    vi.stubGlobal('sessionStorage', hostileStore());
    expect(readDraft(FIELDS)).toBeNull();
    expect(hasDraft()).toBe(false);
  });

  it('swallows a failing write and a failing removal', () => {
    vi.stubGlobal('sessionStorage', hostileStore());
    expect(() => writeDraft({ age: 45 }, FIELDS)).not.toThrow();
    expect(() => clearDraft()).not.toThrow();
  });

  it('keeps the debounced writer from throwing out of a timer callback', () => {
    vi.useFakeTimers();
    vi.stubGlobal('sessionStorage', hostileStore());
    try {
      const writer = createDraftWriter(FIELDS, 500);
      writer.write({ age: 45 });
      // An uncaught throw here has no handler at all — it is a timer callback,
      // not a React event — so it would surface as an unhandled rejection.
      expect(() => vi.advanceTimersByTime(500)).not.toThrow();
      expect(() => writer.flush()).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('degrades when there is no store at all', () => {
    // Server-side rendering and some embedded webviews: the global is simply
    // missing. `storage()` returns null and every entry point becomes a no-op.
    vi.stubGlobal('sessionStorage', undefined);
    expect(readDraft(FIELDS)).toBeNull();
    expect(hasDraft()).toBe(false);
    expect(() => writeDraft({ age: 45 }, FIELDS)).not.toThrow();
    expect(() => clearDraft()).not.toThrow();
  });
});

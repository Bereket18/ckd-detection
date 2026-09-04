import { describe, expect, it } from 'vitest';
import { MODEL_FIXTURE } from '../../tests/fixtures/api';
import { FIELD_COPY, STEPS, STEP_FIELD_ORDER, fieldCopy } from './fields';

/**
 * T-CONTENT-01 · the editorial copy and the model's field list are the same set.
 *
 * ADR-7 splits one concern in two: the backend owns *which* fields exist and in what
 * order, and this frontend owns only the words used to ask for them. That split works
 * exactly as long as the two halves cover the same 24 names, and it fails silently
 * when they do not — a question with no copy renders as a raw column name like `pcv`,
 * and copy for a field the model dropped simply never appears. Neither breaks a
 * build, and neither is visible in review.
 *
 * So the parity is asserted here, against `MODEL_FIXTURE.feature_schema` — a recorded
 * `/model` response, not a second hand-written list. When the backend's schema
 * changes, the fixture is updated to match the new response and this file is what
 * says which copy is now missing.
 *
 * The *order* is deliberately not asserted. `/model.feature_schema` is the order the
 * model expects its columns in; `STEPS` groups the same fields by where a person finds
 * the answer, so one lab report answers one step. Those are different orderings for
 * different readers, and forcing them to agree would make the form worse.
 */

const SCHEMA: readonly string[] = MODEL_FIXTURE.feature_schema;

describe('T-CONTENT-01 · content keys match /model.feature_schema', () => {
  it('reads a schema worth checking against', () => {
    // Vacuity check: an empty fixture would make every assertion below trivially
    // true, which is the failure mode a parity test cannot afford.
    expect(SCHEMA.length).toBe(24);
    expect(SCHEMA.length).toBe(MODEL_FIXTURE.feature_count);
    expect(new Set(SCHEMA).size).toBe(SCHEMA.length);
  });

  it('has copy for every field the model asks for', () => {
    const missing = SCHEMA.filter((name) => FIELD_COPY[name] === undefined);
    expect(missing, 'fields the model asks for with no editorial copy').toEqual([]);
  });

  it('has no copy for a field the model does not ask for', () => {
    const schema = new Set(SCHEMA);
    const extra = Object.keys(FIELD_COPY).filter((name) => !schema.has(name));
    expect(extra, 'copy for fields the model no longer asks for').toEqual([]);
  });

  it('asks every field exactly once across the five steps', () => {
    // A field in two steps is asked twice and the second answer wins; a field in no
    // step is unreachable in the form even though copy exists for it.
    expect([...STEP_FIELD_ORDER].sort()).toEqual([...SCHEMA].sort());
    expect(new Set(STEP_FIELD_ORDER).size).toBe(STEP_FIELD_ORDER.length);
  });

  it('gives every step at least one field', () => {
    for (const step of STEPS) {
      expect(step.fields.length, `step ${step.id} is empty`).toBeGreaterThan(0);
    }
  });
});

describe('the copy itself is usable', () => {
  it.each(SCHEMA)('%s carries a label, a clinical name, a source and an explanation', (name) => {
    const copy = fieldCopy(name);
    expect(copy).toBeDefined();
    if (copy === undefined) return;

    // `unit` is exempt: several of these fields are unitless (yes/no history, a
    // specific gravity), and an invented unit would be worse than an empty one.
    expect(copy.label.trim(), `${name}: label`).not.toBe('');
    expect(copy.clinicalName.trim(), `${name}: clinicalName`).not.toBe('');
    expect(copy.where.trim(), `${name}: where`).not.toBe('');
    expect(copy.help.trim(), `${name}: help`).not.toBe('');
  });

  it('states no numeric range in the copy', () => {
    // Bounds come from `/openapi.json` at runtime (ADR-7). A range written into a
    // sentence here is a second source of truth that no test can keep in step, and
    // it is the exact drift Phase 0 found in the superseded field metadata.
    const ranges: string[] = [];
    for (const [name, copy] of Object.entries(FIELD_COPY)) {
      for (const [field, text] of Object.entries(copy)) {
        if (/\b\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?\b/.test(text)) {
          ranges.push(`${name}.${field}: ${text}`);
        }
      }
    }
    expect(ranges, 'copy stating a numeric range instead of reading it from openapi.json').toEqual(
      []
    );
  });

  it('names a lab report or an answer for every field, without promising a test result', () => {
    // `where` is the field a person reads when they do not have the number to hand.
    // It must not tell them what a normal value is — that is clinical advice this
    // application does not give.
    const advice = Object.entries(FIELD_COPY).filter(([, copy]) =>
      /\bnormal\s+(?:range|value|level)s?\b/i.test(copy.where)
    );
    expect(advice.map(([name]) => name)).toEqual([]);
  });
});

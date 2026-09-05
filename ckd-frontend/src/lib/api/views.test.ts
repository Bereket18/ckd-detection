import { describe, expect, it } from 'vitest';
import { MODEL_FIXTURE, PREDICTION_FIXTURE } from '../../../tests/fixtures/api';
import { REDACTED, containsPath, safeText } from './redact';
import { toModelView, toPredictionView } from './views';

/**
 * T-GUARD-01 · the path leak, closed at the parse boundary.
 *
 * Architecture §8.3 defends one concrete fact four ways: the backend puts absolute
 * filesystem paths in `/model.artifacts[*].path`, in a degraded `/health.detail`,
 * and in a 503 `detail`, and `POST /predict` embeds the whole `/model` document —
 * so the leak reaches Results and Explainability, not only the Model Card.
 *
 * Layer 1 is structural (`toModelView` drops the key), layer 2 is textual
 * (`safeText` scrubs prose), layer 3 is editorial (`detail` is never rendered) and
 * layer 4 is this file. Layers 1 and 2 had no test of their own until now, which
 * made §8.3 a claim rather than a guarantee.
 *
 * The backend is frozen, so redaction cannot move to the server. It is recorded as
 * backend dependency D9.
 */

/** What a real response carries. Used to prove the fixture is worth testing against. */
const REAL_PATH = MODEL_FIXTURE.artifacts.model?.path ?? '';

describe('toModelView', () => {
  it('drops the artifact path and keeps the hash', () => {
    const view = toModelView(MODEL_FIXTURE);

    for (const [name, artifact] of Object.entries(view.artifacts)) {
      // `in` rather than a truthiness check: an `undefined` value still leaves the
      // key on the object, and `JSON.stringify` of that would carry the name of
      // the field a reviewer was told does not exist.
      expect('path' in artifact, `artifacts.${name} still has a path key`).toBe(false);
      expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('keeps every artifact, not only the first', () => {
    const view = toModelView(MODEL_FIXTURE);
    expect(Object.keys(view.artifacts)).toEqual(Object.keys(MODEL_FIXTURE.artifacts));
  });

  it('leaves the rest of the document untouched', () => {
    const view = toModelView(MODEL_FIXTURE);
    expect(view.feature_schema).toEqual(MODEL_FIXTURE.feature_schema);
    expect(view.metrics).toEqual(MODEL_FIXTURE.metrics);
    expect(view.version).toBe(MODEL_FIXTURE.version);
    expect(view.n_rows).toBe(MODEL_FIXTURE.n_rows);
  });

  it('reports the version the server sent rather than deriving one', () => {
    // C3: `version` *is* `sha256[:12]`, computed by the backend — so on a real
    // response, copying and deriving are indistinguishable by value. The two are
    // told apart by feeding a response where they disagree: a projection that
    // slices the hash answers `deadbeefdead`, one that copies answers `v2`.
    const view = toModelView({ ...MODEL_FIXTURE, version: 'v2' });
    expect(view.version).toBe('v2');
  });

  it('survives a response with no artifacts block', () => {
    // Not hypothetical: a degraded service can answer `/model` with less than the
    // happy path, and a projection that throws takes the Model Card down with it.
    const stripped = { ...MODEL_FIXTURE } as Record<string, unknown>;
    delete stripped.artifacts;
    delete stripped.limitations;

    const view = toModelView(stripped as unknown as typeof MODEL_FIXTURE);
    expect(view.artifacts).toEqual({});
    expect(view.limitations).toEqual([]);
  });

  it('redacts a path that arrives inside a limitation', () => {
    const view = toModelView({
      ...MODEL_FIXTURE,
      limitations: [`Loaded from ${REAL_PATH}.`],
    });
    expect(view.limitations[0]).toContain(REDACTED);
    expect(view.limitations[0]).not.toContain('berek');
  });

  it('leaves no path anywhere in the serialised view', () => {
    // The end-to-end statement of the guarantee: whatever the projection did
    // internally, nothing path-shaped survives into what a component can render.
    const serialised = JSON.stringify(toModelView(MODEL_FIXTURE));
    expect(containsPath(serialised)).toBe(false);
    expect(serialised).not.toContain('saved_models');
  });
});

describe('toPredictionView', () => {
  it('projects the embedded model block, not only the top level', () => {
    const view = toPredictionView(PREDICTION_FIXTURE);
    for (const artifact of Object.values(view.model.artifacts)) {
      expect('path' in artifact).toBe(false);
    }
    expect(containsPath(JSON.stringify(view))).toBe(false);
  });

  it('preserves the clinical payload exactly', () => {
    const view = toPredictionView(PREDICTION_FIXTURE);
    // Nothing here may be recomputed, reordered, or rounded: `risk_band` comes from
    // bounds the backend does not expose, and SHAP order *is* the ranking.
    expect(view.prediction).toBe(PREDICTION_FIXTURE.prediction);
    expect(view.ckd_score).toBe(PREDICTION_FIXTURE.ckd_score);
    expect(view.risk_band).toBe(PREDICTION_FIXTURE.risk_band);
    expect(view.shap_drivers).toEqual(PREDICTION_FIXTURE.shap_drivers);
    expect(view.imputed_fields).toEqual(PREDICTION_FIXTURE.imputed_fields);
    expect(view.imputation_count).toBe(PREDICTION_FIXTURE.imputation_count);
  });

  it('does not reword the backend copy it redacts', () => {
    const view = toPredictionView(PREDICTION_FIXTURE);
    expect(view.explanation).toBe(PREDICTION_FIXTURE.explanation);
    expect(view.disclaimer).toBe(PREDICTION_FIXTURE.disclaimer);
  });

  it('keeps a null explanation null rather than turning it into text', () => {
    // `safeText` answers `''` for null so a caller can render without a
    // conditional. `explanation` is different: absent means "render nothing", and
    // `''` would satisfy a truthiness check somewhere and print an empty heading.
    const view = toPredictionView({ ...PREDICTION_FIXTURE, explanation: null });
    expect(view.explanation).toBeNull();
  });
});

describe('safeText', () => {
  it.each([
    ['a Windows path', 'Model at C:\\Users\\berek\\saved_models\\m.joblib failed.'],
    ['a forward-slash Windows path', 'Model at C:/Users/berek/saved_models/m.joblib failed.'],
    ['a UNC path', 'Model at \\\\fileserver\\models\\m.joblib failed.'],
    ['a POSIX path', 'Model at /home/berek/saved_models/m.joblib failed.'],
    ['a container path', 'Model at /app/saved_models/tabular_model.joblib failed.'],
  ])('scrubs %s', (_label, input) => {
    const out = safeText(input);
    expect(out).toContain(REDACTED);
    expect(containsPath(out)).toBe(false);
  });

  it('leaves clinical prose alone', () => {
    // A redactor that eats units or ratios is worse than the leak: it corrupts the
    // one thing the page exists to communicate.
    const prose = 'Serum creatinine 1.2 mg/dL (ratio 3/4) raised the score by 0.18.';
    expect(safeText(prose)).toBe(prose);
  });

  it('leaves an API route alone', () => {
    expect(safeText('Returned by GET /health during this session.')).toContain('/health');
  });

  it.each([null, undefined])('answers an empty string for %s', (value) => {
    // Never the text "null" on screen.
    expect(safeText(value)).toBe('');
  });

  it('collapses the whitespace a multi-line server message arrives with', () => {
    expect(safeText('  Model  \n  missing.  ')).toBe('Model missing.');
  });

  it('scrubs every path in a message that carries two', () => {
    const out = safeText(`model ${REAL_PATH} and preprocessor C:\\x\\y\\p.joblib`);
    expect(out.match(new RegExp(REDACTED.replace(/[[\]]/g, '\\$&'), 'g'))).toHaveLength(2);
  });
});

describe('containsPath', () => {
  it('recognises the path the real backend sends', () => {
    expect(REAL_PATH).not.toBe('');
    expect(containsPath(REAL_PATH)).toBe(true);
  });

  it('is not fooled by ordinary text', () => {
    expect(containsPath('mg/dL')).toBe(false);
    expect(containsPath('Discuss any result with a qualified clinician.')).toBe(false);
  });

  it('gives the same answer twice', () => {
    // The patterns carry the `g` flag, so `lastIndex` persists between calls. A
    // stale index makes the second call answer `false` for the same string — the
    // kind of bug that only shows up once a real page renders two fields.
    expect(containsPath(REAL_PATH)).toBe(true);
    expect(containsPath(REAL_PATH)).toBe(true);
  });
});

/**
 * API fixtures — the verified response shapes, in one place.
 *
 * Every fixture here mirrors what the running backend actually returns (read from
 * `api/schemas.py` and `src/services/clinical_prediction.py`, not invented). Two
 * details are deliberate and must not be "cleaned up":
 *
 * - `artifacts.*.path` carries a real-looking absolute Windows path, because the
 *   backend really does send one and the guard tests need something to catch.
 * - `shap_drivers[*].value` is a signed SHAP value and `direction` agrees with
 *   its sign. Tests that need a contract violation must construct it explicitly.
 */

import type {
  HealthResponse,
  ModelMetadata,
  OpenApiDocument,
  PredictionResponse,
} from '../../src/types/api.types';

export const MODEL_FIXTURE: ModelMetadata = {
  name: 'RandomForestClassifier',
  version: '9f2c1ab44e70',
  feature_count: 24,
  feature_schema: [
    'age',
    'bp',
    'sg',
    'al',
    'su',
    'bgr',
    'bu',
    'sc',
    'sod',
    'pot',
    'hemo',
    'pcv',
    'wc',
    'rc',
    'rbc',
    'pc',
    'pcc',
    'ba',
    'htn',
    'dm',
    'cad',
    'appet',
    'pe',
    'ane',
  ],
  datasets: ['ckd_clean.csv'],
  n_rows: 400,
  n_train: 320,
  n_test: 80,
  metrics: {
    accuracy: 0.9875,
    precision: 0.98,
    recall: 1.0,
    specificity: 0.9667,
    f1: 0.9899,
    auc_roc: 0.9993,
    brier_score: 0.0121,
    confusion_matrix: [
      [29, 1],
      [0, 50],
    ],
    intervals: { accuracy: [0.9296, 0.9998] },
  },
  artifacts: {
    model: {
      path: 'C:\\Users\\berek\\Desktop\\ckd-federated-agent\\ckd-detection\\saved_models\\tabular_model.joblib',
      sha256: '9f2c1ab44e7031bd9b2f0c6e5a1d8877ab4c2f10de93c5b6a7e8f9012345abcd',
    },
    preprocessor: {
      path: 'C:\\Users\\berek\\Desktop\\ckd-federated-agent\\ckd-detection\\saved_models\\preprocessor.joblib',
      sha256: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f809',
    },
  },
  limitations: [
    'The CKD score is not a calibrated probability.',
    'Trained on a single-source dataset of 400 records.',
    'Not validated on an Ethiopian population.',
    'SHAP values explain the model, not the disease.',
    'Not a diagnostic device.',
  ],
};

/**
 * A `ckd` + `HIGH` prediction — one of the four reachable states.
 *
 * `model` is the same block `/model` returns, because `predict_one()` embeds
 * `self.model_metadata()` verbatim. That is exactly how the absolute path reaches
 * the Results and Explainability pages.
 */
export const PREDICTION_FIXTURE: PredictionResponse = {
  prediction: 'ckd',
  ckd_score: 0.87,
  risk_band: 'HIGH',
  imputed_fields: [],
  imputation_count: 0,
  shap_drivers: [
    { feature: 'sc', value: 0.184, direction: 'raises_risk' },
    { feature: 'hemo', value: -0.092, direction: 'lowers_risk' },
    { feature: 'al', value: 0.061, direction: 'raises_risk' },
  ],
  explanation:
    'Serum creatinine and albumin contributed most to this score. This is a screening signal, not a diagnosis.',
  model: MODEL_FIXTURE,
  disclaimer:
    'This tool does not diagnose chronic kidney disease. Discuss any result with a qualified clinician.',
};

/** A `notckd` + `LOW` prediction with imputed fields, for the disclosure path. */
export const PREDICTION_IMPUTED_FIXTURE: PredictionResponse = {
  ...PREDICTION_FIXTURE,
  prediction: 'notckd',
  ckd_score: 0.18,
  risk_band: 'LOW',
  imputed_fields: ['sod', 'pot', 'rc'],
  imputation_count: 3,
  shap_drivers: [
    { feature: 'hemo', value: -0.147, direction: 'lowers_risk' },
    { feature: 'sc', value: -0.088, direction: 'lowers_risk' },
    { feature: 'sg', value: 0.004, direction: 'neutral' },
  ],
};

export const HEALTH_OK_FIXTURE: HealthResponse = {
  status: 'ok',
  model: 'ready',
  preprocessor: 'ready',
  shap: 'ready',
  schema_compatible: true,
  feature_count: 24,
  detail: null,
};

/**
 * A degraded probe. This arrives with **HTTP 200**, which is why `useHealth`
 * needs four states rather than three, and its `detail` carries a server path —
 * so `detail` is never rendered.
 */
export const HEALTH_DEGRADED_FIXTURE: HealthResponse = {
  status: 'degraded',
  model: 'missing',
  preprocessor: 'ready',
  shap: 'unavailable',
  schema_compatible: false,
  feature_count: null,
  detail:
    "Model artifact not found at C:\\Users\\berek\\Desktop\\ckd-federated-agent\\ckd-detection\\saved_models\\tabular_model.joblib",
};

/**
 * A trimmed `/openapi.json`: one numeric field with `ge`/`le`, one nullable
 * numeric wrapped in `anyOf`, and one categorical `enum`. Enough to exercise the
 * bounds reader without pasting 24 schemas.
 */
export const OPENAPI_FIXTURE: OpenApiDocument = {
  components: {
    schemas: {
      PatientAssessment: {
        type: 'object',
        properties: {
          age: { anyOf: [{ type: 'number', minimum: 0, maximum: 120 }, { type: 'null' }] },
          bp: { anyOf: [{ type: 'number', minimum: 40, maximum: 250 }, { type: 'null' }] },
          rbc: { anyOf: [{ type: 'string', enum: ['normal', 'abnormal'] }, { type: 'null' }] },
          htn: { anyOf: [{ type: 'string', enum: ['yes', 'no'] }, { type: 'null' }] },
        },
      },
    },
  },
};

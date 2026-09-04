/**
 * API Response Types
 * 
 * These types mirror the backend API schemas defined in api/schemas.py
 * All interfaces match the FastAPI backend's Pydantic models exactly.
 */

/**
 * Patient Assessment Input Schema
 * Represents the 24 clinical features required for CKD risk assessment
 * All fields are nullable to support missing data (handled by backend imputation)
 */
export interface PatientAssessment {
  // Demographic features
  age: number | null;  // Patient age in years (0-120)
  bp: number | null;   // Blood pressure in mmHg (30-200)
  
  // Lab value features
  sg: number | null;   // Specific gravity (1.0-1.03)
  al: number | null;   // Albumin level (0-5)
  su: number | null;   // Sugar level (0-5)
  bgr: number | null;  // Blood glucose random in mg/dL (0-600)
  bu: number | null;   // Blood urea in mg/dL (0-400)
  sc: number | null;   // Serum creatinine in mg/dL (0-80)
  sod: number | null;  // Sodium in mEq/L (0-200)
  pot: number | null;  // Potassium in mEq/L (0-50)
  hemo: number | null; // Hemoglobin in gms (0-25)
  pcv: number | null;  // Packed cell volume (0-60)
  wc: number | null;   // White blood cell count in cells/cumm (0-30000)
  rc: number | null;   // Red blood cell count in millions/cmm (0-10)
  
  // Clinical observation features
  rbc: 'normal' | 'abnormal' | null;      // Red blood cells
  pc: 'normal' | 'abnormal' | null;       // Pus cell
  pcc: 'present' | 'notpresent' | null;   // Pus cell clumps
  ba: 'present' | 'notpresent' | null;    // Bacteria
  
  // Medical history features
  htn: 'yes' | 'no' | null;    // Hypertension
  dm: 'yes' | 'no' | null;     // Diabetes mellitus
  cad: 'yes' | 'no' | null;    // Coronary artery disease
  appet: 'good' | 'poor' | null;  // Appetite
  pe: 'yes' | 'no' | null;     // Pedal edema
  ane: 'yes' | 'no' | null;    // Anemia
}

/**
 * SHAP Driver Schema
 * Represents a single feature's contribution to the prediction.
 *
 * `feature` is a raw field name from `/model.feature_schema`, so a driver can be
 * joined against the submitted assessment to show the patient's own value.
 * `value` is the signed SHAP value; `direction` is the backend's reading of its
 * sign. The frontend renders `direction` and never re-derives it (plan R4.3).
 */
export interface ShapDriver {
  feature: string;
  value: number;
  direction: 'raises_risk' | 'lowers_risk' | 'neutral';
}

/**
 * `GET /model` — the metadata document, as the backend actually returns it.
 *
 * Every field below was observed in a live response (architecture §11.1). Keys
 * inside `metrics` are copied conditionally by `ClinicalPredictionService.
 * model_metadata()`, hence optional; absence means "not reported", never zero.
 *
 * There is no training date in this contract. `training_date` was a fabricated
 * field on the old `ModelInfo` and is deliberately not declared (backend
 * dependency D1).
 */
export interface ModelMetadata {
  name: string;
  version: string; // = artifacts.model.sha256.slice(0, 12)
  feature_count: number;
  feature_schema: string[]; // 24 raw field names, model order
  datasets: string[];
  n_rows: number | null;
  n_train: number | null;
  n_test: number | null;
  metrics: ModelMetrics;
  /** `path` is an absolute server path and is NEVER rendered (§8.3). */
  artifacts: Record<string, { path: string; sha256: string }>;
  limitations: string[];
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  specificity?: number;
  f1?: number;
  auc_roc?: number;
  brier_score?: number;
  confusion_matrix?: number[][];
  intervals?: Record<string, [number, number]>;
}

/**
 * What components receive: identical to {@link ModelMetadata} except that the
 * filesystem path is dropped at the parse boundary, so a component cannot
 * render what it never receives (§8.3, layer 1).
 */
export interface ModelView extends Omit<ModelMetadata, 'artifacts'> {
  artifacts: Record<string, { sha256: string }>;
}

/**
 * `POST /predict` — the prediction response.
 *
 * `ckd_score` is the model's raw positive-class score. It is **not** a
 * calibrated probability — the backend says so itself in `model.limitations` —
 * so it is never presented as a percentage chance of disease (plan R3.4).
 *
 * `risk_band` is computed by the backend from bounds it does not expose. It is
 * consumed as given and never recomputed (plan R3.2).
 *
 * `model` is the complete `/model` document, embedded verbatim — which means the
 * `artifacts[*].path` leak reaches Results and Explainability too, not only the
 * Model Card (§8.3, C1).
 *
 * `explanation` is backend-authored patient-facing copy. It is rendered verbatim
 * or not at all; the frontend never paraphrases it (plan R3.3).
 */
export interface PredictionResponse {
  prediction: 'ckd' | 'notckd';
  ckd_score: number;
  risk_band: RiskBand;
  imputed_fields: string[];
  imputation_count: number;
  shap_drivers: ShapDriver[];
  explanation: string | null;
  model: ModelMetadata;
  disclaimer: string;
}

/** Risk band as returned by the backend. Never derived frontend-side. */
export type RiskBand = 'LOW' | 'MODERATE' | 'HIGH';

/** Verdict as returned by the backend. */
export type Verdict = 'ckd' | 'notckd';

/**
 * A prediction with its server-supplied paths already stripped — the shape the
 * prediction context holds and components consume.
 */
export interface PredictionView extends Omit<PredictionResponse, 'model'> {
  model: ModelView;
}

/**
 * Batch Prediction Item Schema
 * Represents a single prediction result in batch processing
 */
export interface BatchPredictionItem {
  prediction: Verdict;
  ckd_score: number;
  risk_band: RiskBand;
  imputed_fields: string[];
  imputation_count: number;
  shap_drivers: ShapDriver[];
}

/**
 * Batch Prediction Response Schema
 * Contains results for multiple patient assessments
 */
export interface BatchPredictionResponse {
  count: number;                         // Total number of predictions
  results: BatchPredictionItem[];        // Array of prediction results
}

/**
 * `GET /health` — a status probe, not a model description.
 *
 * `model`, `preprocessor`, and `shap` are artefact *statuses* (`"ready"`), not
 * names — the old spec's "display the model name from /health" was wrong about
 * the contract. A name only exists on `/model`.
 *
 * A degraded response arrives with **HTTP 200**, not an error status, and its
 * `detail` may embed an absolute server path — so `detail` is used to select a
 * message and is never rendered (§8.3, layer 3).
 */
export interface HealthResponse {
  status: 'ok' | 'degraded';
  model: string;
  preprocessor: string;
  shap: string;
  schema_compatible: boolean;
  feature_count: number | null;
  detail: string | null;
}

/**
 * The subset of `GET /openapi.json` the frontend reads: the numeric bounds and
 * enum values FastAPI emits for `PatientAssessment`. Bounds are read from here
 * rather than copied into frontend source, so the two cannot disagree (§6.1).
 *
 * Nullable fields are emitted as `anyOf: [<constrained>, { type: 'null' }]`, so
 * the reader takes the non-null branch.
 */
export interface OpenApiDocument {
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
}

export interface OpenApiSchema {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  anyOf?: OpenApiSchema[];
  enum?: string[];
  const?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  title?: string;
}

/**
 * API Status Type (Frontend-specific)
 * Tracks the current state of API availability
 */
export interface ApiStatus {
  status: 'checking' | 'ok' | 'degraded' | 'offline';
  lastChecked: Date | null;
}

/**
 * User Message Type (Frontend-specific)
 * Represents a notification or alert message to display to the user
 */
export interface UserMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  action?: string;  // Optional action text (e.g., "Retry", "Review")
}

/**
 * Field Error Type (Frontend-specific)
 * Represents a validation error for a specific form field
 */
export interface FieldError {
  field: string;     // Field name (e.g., "age", "bp")
  message: string;   // Error message to display
}

/**
 * Type Guards
 * Helper functions to validate response types at runtime
 */

export function isPredictionResponse(data: unknown): data is PredictionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'prediction' in data &&
    'ckd_score' in data &&
    'risk_band' in data &&
    'shap_drivers' in data
  );
}

export function isModelMetadata(data: unknown): data is ModelMetadata {
  return (
    typeof data === 'object' &&
    data !== null &&
    'feature_schema' in data &&
    Array.isArray((data as ModelMetadata).feature_schema) &&
    'version' in data &&
    'limitations' in data
  );
}

export function isHealthResponse(data: unknown): data is HealthResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    'model' in data &&
    'schema_compatible' in data
  );
}

export function isBatchPredictionResponse(data: unknown): data is BatchPredictionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'count' in data &&
    'results' in data &&
    Array.isArray((data as BatchPredictionResponse).results)
  );
}

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
 * Represents a single feature's contribution to the prediction
 */
export interface ShapDriver {
  feature: string;  // Feature name (e.g., "age", "bp", "sc")
  value: number;    // SHAP value indicating impact magnitude
  direction: 'raises_risk' | 'lowers_risk' | 'neutral';  // Direction of impact
}

/**
 * Model Information Schema
 * Contains metadata about the model used for predictions
 */
export interface ModelInfo {
  name: string;
  version: string;
  accuracy?: number;
  recall?: number;
  precision?: number;
  training_date?: string;
}

/**
 * Prediction Response Schema
 * Contains the complete prediction result with explanations
 */
export interface PredictionResponse {
  prediction: 'ckd' | 'notckd';  // Binary classification result
  ckd_score: number;              // Confidence score (0-1)
  risk_band: 'LOW' | 'MODERATE' | 'HIGH';  // Risk category
  imputed_fields: string[];       // List of fields that were imputed
  imputation_count: number;       // Count of imputed fields
  shap_drivers: ShapDriver[];     // Top contributing features
  explanation: string | null;     // Optional textual explanation
  model: Record<string, unknown>; // Model metadata dictionary
  disclaimer: string;             // Disclaimer text for clinical use
}

/**
 * Batch Prediction Item Schema
 * Represents a single prediction result in batch processing
 */
export interface BatchPredictionItem {
  prediction: 'ckd' | 'notckd';
  ckd_score: number;
  risk_band: 'LOW' | 'MODERATE' | 'HIGH';
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
 * Health Response Schema
 * Provides API health status and model availability information
 */
export interface HealthResponse {
  status: 'ok' | 'degraded';     // API operational status
  model: string;                  // Model artifact status
  preprocessor: string;           // Preprocessor artifact status
  shap: string;                   // SHAP explainer artifact status
  schema_compatible: boolean;     // Schema compatibility check
  feature_count: number | null;   // Number of features expected by model
  detail: string | null;          // Optional detail message
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

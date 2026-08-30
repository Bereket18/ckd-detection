/**
 * Field Metadata Configuration
 * 
 * Provides comprehensive metadata for all 24 clinical features in the CKD assessment form.
 * This metadata drives form rendering, validation, tooltips, and sectioning.
 */

/**
 * Field Type Definition
 */
export type FieldType = 'numeric' | 'categorical';

/**
 * Section Type Definition
 * Groups related clinical features logically for better UX
 */
export type FieldSection = 'demographics' | 'lab_values' | 'clinical_obs' | 'medical_history';

/**
 * Option Definition for Categorical Fields
 */
export interface FieldOption {
  value: string;
  label: string;
}

/**
 * Field Metadata Interface
 * Defines all properties needed to render and validate a clinical feature input
 */
export interface FieldMetadata {
  name: string;           // Field name (matches PatientAssessment property)
  label: string;          // Short label for UI display (abbreviation)
  fullName: string;       // Full clinical name for clarity
  type: FieldType;        // Input type (numeric or categorical)
  unit?: string;          // Measurement unit (e.g., "mmHg", "mg/dL")
  min?: number;           // Minimum valid value (numeric fields only)
  max?: number;           // Maximum valid value (numeric fields only)
  options?: FieldOption[]; // Available options (categorical fields only)
  section: FieldSection;  // Logical grouping section
  tooltip: string;        // Clinical context and guidance for clinicians
}

/**
 * Complete Field Metadata Configuration
 * Maps all 24 clinical features to their metadata
 */
export const FIELD_METADATA: Record<string, FieldMetadata> = {
  // ========================================
  // Demographics Section
  // ========================================
  age: {
    name: 'age',
    label: 'Age',
    fullName: 'Patient Age',
    type: 'numeric',
    unit: 'years',
    min: 0,
    max: 120,
    section: 'demographics',
    tooltip: 'Patient age in years. CKD risk typically increases with age, especially after 60 years.',
  },
  
  bp: {
    name: 'bp',
    label: 'BP',
    fullName: 'Blood Pressure (Diastolic)',
    type: 'numeric',
    unit: 'mmHg',
    min: 30,
    max: 200,
    section: 'demographics',
    tooltip: 'Diastolic blood pressure in mmHg. Elevated BP (>90 mmHg) is a major risk factor for CKD and may indicate hypertensive nephropathy.',
  },

  // ========================================
  // Lab Values Section
  // ========================================
  sg: {
    name: 'sg',
    label: 'SG',
    fullName: 'Specific Gravity',
    type: 'numeric',
    unit: '',
    min: 1.0,
    max: 1.03,
    section: 'lab_values',
    tooltip: 'Urine specific gravity (1.0-1.03). Low values (<1.010) may indicate impaired kidney concentrating ability.',
  },
  
  al: {
    name: 'al',
    label: 'AL',
    fullName: 'Albumin',
    type: 'numeric',
    unit: '',
    min: 0,
    max: 5,
    section: 'lab_values',
    tooltip: 'Albumin in urine (0-5 scale). Elevated albumin (proteinuria) is a key indicator of kidney damage.',
  },
  
  su: {
    name: 'su',
    label: 'SU',
    fullName: 'Sugar',
    type: 'numeric',
    unit: '',
    min: 0,
    max: 5,
    section: 'lab_values',
    tooltip: 'Sugar in urine (0-5 scale). Presence of sugar may indicate diabetes, a major CKD risk factor.',
  },
  
  bgr: {
    name: 'bgr',
    label: 'BGR',
    fullName: 'Blood Glucose Random',
    type: 'numeric',
    unit: 'mg/dL',
    min: 0,
    max: 600,
    section: 'lab_values',
    tooltip: 'Random blood glucose in mg/dL. Values >200 mg/dL suggest uncontrolled diabetes, which accelerates kidney damage.',
  },
  
  bu: {
    name: 'bu',
    label: 'BU',
    fullName: 'Blood Urea',
    type: 'numeric',
    unit: 'mg/dL',
    min: 0,
    max: 400,
    section: 'lab_values',
    tooltip: 'Blood urea in mg/dL. Elevated levels (>40 mg/dL) indicate impaired kidney filtration function.',
  },
  
  sc: {
    name: 'sc',
    label: 'SC',
    fullName: 'Serum Creatinine',
    type: 'numeric',
    unit: 'mg/dL',
    min: 0,
    max: 80,
    section: 'lab_values',
    tooltip: 'Serum creatinine in mg/dL. Key kidney function marker; elevated levels (>1.2 mg/dL) indicate reduced GFR and kidney impairment.',
  },
  
  sod: {
    name: 'sod',
    label: 'SOD',
    fullName: 'Sodium',
    type: 'numeric',
    unit: 'mEq/L',
    min: 0,
    max: 200,
    section: 'lab_values',
    tooltip: 'Serum sodium in mEq/L. Normal range is 135-145 mEq/L; abnormalities may indicate fluid-electrolyte imbalance in CKD.',
  },
  
  pot: {
    name: 'pot',
    label: 'POT',
    fullName: 'Potassium',
    type: 'numeric',
    unit: 'mEq/L',
    min: 0,
    max: 50,
    section: 'lab_values',
    tooltip: 'Serum potassium in mEq/L. Elevated levels (>5.5 mEq/L) can occur in CKD due to reduced renal excretion.',
  },
  
  hemo: {
    name: 'hemo',
    label: 'HEMO',
    fullName: 'Hemoglobin',
    type: 'numeric',
    unit: 'gms',
    min: 0,
    max: 25,
    section: 'lab_values',
    tooltip: 'Hemoglobin in grams. Low levels (<12 gms for women, <13 gms for men) indicate anemia, common in CKD due to reduced erythropoietin.',
  },
  
  pcv: {
    name: 'pcv',
    label: 'PCV',
    fullName: 'Packed Cell Volume',
    type: 'numeric',
    unit: '%',
    min: 0,
    max: 60,
    section: 'lab_values',
    tooltip: 'Packed cell volume (hematocrit) in percentage. Low values (<36% for women, <40% for men) suggest anemia related to CKD.',
  },
  
  wc: {
    name: 'wc',
    label: 'WC',
    fullName: 'White Blood Cell Count',
    type: 'numeric',
    unit: 'cells/cumm',
    min: 0,
    max: 30000,
    section: 'lab_values',
    tooltip: 'White blood cell count in cells/cumm. Elevated counts may indicate infection or inflammation affecting kidneys.',
  },
  
  rc: {
    name: 'rc',
    label: 'RC',
    fullName: 'Red Blood Cell Count',
    type: 'numeric',
    unit: 'millions/cmm',
    min: 0,
    max: 10,
    section: 'lab_values',
    tooltip: 'Red blood cell count in millions/cmm. Low counts (<4.5 million for women, <5.0 million for men) suggest anemia common in CKD.',
  },

  // ========================================
  // Clinical Observations Section
  // ========================================
  rbc: {
    name: 'rbc',
    label: 'RBC',
    fullName: 'Red Blood Cells (Urine)',
    type: 'categorical',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'abnormal', label: 'Abnormal' },
    ],
    section: 'clinical_obs',
    tooltip: 'Red blood cells in urine microscopy. Abnormal findings (hematuria) may indicate glomerular disease or kidney damage.',
  },
  
  pc: {
    name: 'pc',
    label: 'PC',
    fullName: 'Pus Cell',
    type: 'categorical',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'abnormal', label: 'Abnormal' },
    ],
    section: 'clinical_obs',
    tooltip: 'Pus cells in urine microscopy. Abnormal levels suggest urinary tract infection or inflammation.',
  },
  
  pcc: {
    name: 'pcc',
    label: 'PCC',
    fullName: 'Pus Cell Clumps',
    type: 'categorical',
    options: [
      { value: 'present', label: 'Present' },
      { value: 'notpresent', label: 'Not Present' },
    ],
    section: 'clinical_obs',
    tooltip: 'Pus cell clumps in urine. Presence indicates severe infection or inflammation in the urinary system.',
  },
  
  ba: {
    name: 'ba',
    label: 'BA',
    fullName: 'Bacteria',
    type: 'categorical',
    options: [
      { value: 'present', label: 'Present' },
      { value: 'notpresent', label: 'Not Present' },
    ],
    section: 'clinical_obs',
    tooltip: 'Bacteria in urine microscopy. Presence indicates urinary tract infection which can affect kidney function.',
  },

  // ========================================
  // Medical History Section
  // ========================================
  htn: {
    name: 'htn',
    label: 'HTN',
    fullName: 'Hypertension',
    type: 'categorical',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    section: 'medical_history',
    tooltip: 'History of hypertension. High blood pressure is both a cause and consequence of CKD, creating a damaging cycle.',
  },
  
  dm: {
    name: 'dm',
    label: 'DM',
    fullName: 'Diabetes Mellitus',
    type: 'categorical',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    section: 'medical_history',
    tooltip: 'History of diabetes mellitus. Diabetes is the leading cause of CKD, causing diabetic nephropathy.',
  },
  
  cad: {
    name: 'cad',
    label: 'CAD',
    fullName: 'Coronary Artery Disease',
    type: 'categorical',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    section: 'medical_history',
    tooltip: 'History of coronary artery disease. Cardiovascular disease and CKD often coexist and worsen each other.',
  },
  
  appet: {
    name: 'appet',
    label: 'APPET',
    fullName: 'Appetite',
    type: 'categorical',
    options: [
      { value: 'good', label: 'Good' },
      { value: 'poor', label: 'Poor' },
    ],
    section: 'medical_history',
    tooltip: 'Patient appetite status. Poor appetite is a common symptom in advanced CKD due to uremia.',
  },
  
  pe: {
    name: 'pe',
    label: 'PE',
    fullName: 'Pedal Edema',
    type: 'categorical',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    section: 'medical_history',
    tooltip: 'Swelling in feet and ankles. Pedal edema indicates fluid retention, common in CKD due to impaired sodium and water excretion.',
  },
  
  ane: {
    name: 'ane',
    label: 'ANE',
    fullName: 'Anemia',
    type: 'categorical',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
    section: 'medical_history',
    tooltip: 'Diagnosed anemia. Anemia is prevalent in CKD patients due to reduced erythropoietin production by damaged kidneys.',
  },
};

/**
 * Section Metadata
 * Provides information about each form section for rendering headers and descriptions
 */
export interface SectionMetadata {
  key: FieldSection;
  title: string;
  description: string;
  order: number; // Display order in the form
}

export const SECTION_METADATA: Record<FieldSection, SectionMetadata> = {
  demographics: {
    key: 'demographics',
    title: 'Demographics',
    description: 'Basic patient demographic information',
    order: 1,
  },
  lab_values: {
    key: 'lab_values',
    title: 'Laboratory Values',
    description: 'Blood and urine laboratory test results',
    order: 2,
  },
  clinical_obs: {
    key: 'clinical_obs',
    title: 'Clinical Observations',
    description: 'Urine microscopy findings',
    order: 3,
  },
  medical_history: {
    key: 'medical_history',
    title: 'Medical History',
    description: 'Patient medical history and current symptoms',
    order: 4,
  },
};

/**
 * Utility Functions
 */

/**
 * Get all field names in the order they should appear in the form
 */
export function getAllFieldNames(): string[] {
  return Object.keys(FIELD_METADATA);
}

/**
 * Get fields grouped by section in display order
 */
export function getFieldsBySection(): Record<FieldSection, FieldMetadata[]> {
  const grouped: Record<FieldSection, FieldMetadata[]> = {
    demographics: [],
    lab_values: [],
    clinical_obs: [],
    medical_history: [],
  };

  Object.values(FIELD_METADATA).forEach((field) => {
    grouped[field.section].push(field);
  });

  return grouped;
}

/**
 * Get field metadata by name
 */
export function getFieldMetadata(fieldName: string): FieldMetadata | undefined {
  return FIELD_METADATA[fieldName];
}

/**
 * Get all sections in display order
 */
export function getSectionsInOrder(): SectionMetadata[] {
  return Object.values(SECTION_METADATA).sort((a, b) => a.order - b.order);
}

/**
 * Check if a field is numeric
 */
export function isNumericField(fieldName: string): boolean {
  return FIELD_METADATA[fieldName]?.type === 'numeric';
}

/**
 * Check if a field is categorical
 */
export function isCategoricalField(fieldName: string): boolean {
  return FIELD_METADATA[fieldName]?.type === 'categorical';
}

/**
 * Get human-readable field label (abbreviation - full name with unit)
 */
export function getFieldLabel(fieldName: string): string {
  const field = FIELD_METADATA[fieldName];
  if (!field) return fieldName;
  
  const parts = [field.label, '-', field.fullName];
  if (field.unit) {
    parts.push(`(${field.unit})`);
  }
  
  return parts.join(' ');
}

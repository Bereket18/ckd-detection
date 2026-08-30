/**
 * Zod Validation Schema for Patient Assessment
 * 
 * This schema validates patient clinical data for CKD risk assessment.
 * All fields support null values to handle missing data (imputed by backend).
 * 
 * Field ranges and enums exactly match the backend API schema (api/schemas.py).
 * Use with React Hook Form via @hookform/resolvers/zod.
 */

import { z } from 'zod';

/**
 * Patient Assessment Validation Schema
 * 
 * Validates all 24 clinical features with appropriate constraints:
 * - Numeric fields: min/max validation matching API schema
 * - Categorical fields: enum validation with exact API values
 * - All fields: nullable to support missing data
 */
export const patientAssessmentSchema = z.object({
  // ============================================================
  // Demographic Features
  // ============================================================
  
  /**
   * Age in years
   * Range: 0-120
   * Nullable: Yes
   */
  age: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(120, { message: 'Value must be at most 120' })
    .nullable()
    .optional(),

  /**
   * Blood Pressure in mmHg (diastolic)
   * Range: 30-200
   * Nullable: Yes
   */
  bp: z
    .number({
      message: 'Must be a valid number',
    })
    .min(30, { message: 'Value must be at least 30' })
    .max(200, { message: 'Value must be at most 200' })
    .nullable()
    .optional(),

  // ============================================================
  // Lab Value Features
  // ============================================================

  /**
   * Specific Gravity
   * Range: 1.0-1.03
   * Nullable: Yes
   */
  sg: z
    .number({
      message: 'Must be a valid number',
    })
    .min(1.0, { message: 'Value must be at least 1.0' })
    .max(1.03, { message: 'Value must be at most 1.03' })
    .nullable()
    .optional(),

  /**
   * Albumin Level
   * Range: 0-5
   * Nullable: Yes
   */
  al: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(5, { message: 'Value must be at most 5' })
    .nullable()
    .optional(),

  /**
   * Sugar Level
   * Range: 0-5
   * Nullable: Yes
   */
  su: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(5, { message: 'Value must be at most 5' })
    .nullable()
    .optional(),

  /**
   * Blood Glucose Random in mg/dL
   * Range: 0-600
   * Nullable: Yes
   */
  bgr: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(600, { message: 'Value must be at most 600' })
    .nullable()
    .optional(),

  /**
   * Blood Urea in mg/dL
   * Range: 0-400
   * Nullable: Yes
   */
  bu: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(400, { message: 'Value must be at most 400' })
    .nullable()
    .optional(),

  /**
   * Serum Creatinine in mg/dL
   * Range: 0-80
   * Nullable: Yes
   */
  sc: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(80, { message: 'Value must be at most 80' })
    .nullable()
    .optional(),

  /**
   * Sodium in mEq/L
   * Range: 0-200
   * Nullable: Yes
   */
  sod: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(200, { message: 'Value must be at most 200' })
    .nullable()
    .optional(),

  /**
   * Potassium in mEq/L
   * Range: 0-50
   * Nullable: Yes
   */
  pot: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(50, { message: 'Value must be at most 50' })
    .nullable()
    .optional(),

  /**
   * Hemoglobin in gms
   * Range: 0-25
   * Nullable: Yes
   */
  hemo: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(25, { message: 'Value must be at most 25' })
    .nullable()
    .optional(),

  /**
   * Packed Cell Volume
   * Range: 0-60
   * Nullable: Yes
   */
  pcv: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(60, { message: 'Value must be at most 60' })
    .nullable()
    .optional(),

  /**
   * White Blood Cell Count in cells/cumm
   * Range: 0-30000
   * Nullable: Yes
   */
  wc: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(30000, { message: 'Value must be at most 30000' })
    .nullable()
    .optional(),

  /**
   * Red Blood Cell Count in millions/cmm
   * Range: 0-10
   * Nullable: Yes
   */
  rc: z
    .number({
      message: 'Must be a valid number',
    })
    .min(0, { message: 'Value must be at least 0' })
    .max(10, { message: 'Value must be at most 10' })
    .nullable()
    .optional(),

  // ============================================================
  // Clinical Observation Features
  // ============================================================

  /**
   * Red Blood Cells
   * Values: normal, abnormal
   * Nullable: Yes
   */
  rbc: z
    .enum(['normal', 'abnormal'], { message: "Must be "normal" or "abnormal"" })
    .nullable()
    .optional(),

  /**
   * Pus Cell
   * Values: normal, abnormal
   * Nullable: Yes
   */
  pc: z
    .enum(['normal', 'abnormal'], { message: "Must be "normal" or "abnormal"" })
    .nullable()
    .optional(),

  /**
   * Pus Cell Clumps
   * Values: present, notpresent
   * Nullable: Yes
   */
  pcc: z
    .enum(['present', 'notpresent'], { message: "Must be "present" or "notpresent"" })
    .nullable()
    .optional(),

  /**
   * Bacteria
   * Values: present, notpresent
   * Nullable: Yes
   */
  ba: z
    .enum(['present', 'notpresent'], { message: "Must be "present" or "notpresent"" })
    .nullable()
    .optional(),

  // ============================================================
  // Medical History Features
  // ============================================================

  /**
   * Hypertension
   * Values: yes, no
   * Nullable: Yes
   */
  htn: z
    .enum(['yes', 'no'], { message: "Must be "yes" or "no"" })
    .nullable()
    .optional(),

  /**
   * Diabetes Mellitus
   * Values: yes, no
   * Nullable: Yes
   */
  dm: z
    .enum(['yes', 'no'], { message: "Must be "yes" or "no"" })
    .nullable()
    .optional(),

  /**
   * Coronary Artery Disease
   * Values: yes, no
   * Nullable: Yes
   */
  cad: z
    .enum(['yes', 'no'], { message: "Must be "yes" or "no"" })
    .nullable()
    .optional(),

  /**
   * Appetite
   * Values: good, poor
   * Nullable: Yes
   */
  appet: z
    .enum(['good', 'poor'], { message: "Must be "good" or "poor"" })
    .nullable()
    .optional(),

  /**
   * Pedal Edema
   * Values: yes, no
   * Nullable: Yes
   */
  pe: z
    .enum(['yes', 'no'], { message: "Must be "yes" or "no"" })
    .nullable()
    .optional(),

  /**
   * Anemia
   * Values: yes, no
   * Nullable: Yes
   */
  ane: z
    .enum(['yes', 'no'], { message: "Must be "yes" or "no"" })
    .nullable()
    .optional(),
});

/**
 * Type inference from schema
 * Use this type for form data throughout the application
 */
export type PatientAssessmentFormData = z.infer<typeof patientAssessmentSchema>;

/**
 * Helper function to validate patient assessment data
 * 
 * @param data - Patient assessment data to validate
 * @returns Validation result with success status and data/errors
 */
export function validatePatientAssessment(data: unknown) {
  return patientAssessmentSchema.safeParse(data);
}

/**
 * Default form values
 * All fields default to null (missing data)
 */
export const defaultPatientAssessment: PatientAssessmentFormData = {
  age: null,
  bp: null,
  sg: null,
  al: null,
  su: null,
  bgr: null,
  bu: null,
  sc: null,
  sod: null,
  pot: null,
  hemo: null,
  pcv: null,
  wc: null,
  rc: null,
  rbc: null,
  pc: null,
  pcc: null,
  ba: null,
  htn: null,
  dm: null,
  cad: null,
  appet: null,
  pe: null,
  ane: null,
};

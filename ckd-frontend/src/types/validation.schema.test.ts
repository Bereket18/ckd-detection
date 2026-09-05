/**
 * Unit Tests for Patient Assessment Validation Schema
 * 
 * Tests validate:
 * - Numeric field min/max ranges
 * - Categorical field enum values
 * - Null value handling for all fields
 * - Error messages for validation failures
 */

import { describe, it, expect } from 'vitest';
import {
  patientAssessmentSchema,
  validatePatientAssessment,
  defaultPatientAssessment,
  type PatientAssessmentFormData,
} from './validation.schema';

describe('patientAssessmentSchema', () => {
  describe('Numeric Field Validation', () => {
    describe('age field', () => {
      it('should accept valid age values within range (0-120)', () => {
        const result = patientAssessmentSchema.safeParse({ age: 45 });
        expect(result.success).toBe(true);
      });

      it('should accept age at minimum boundary (0)', () => {
        const result = patientAssessmentSchema.safeParse({ age: 0 });
        expect(result.success).toBe(true);
      });

      it('should accept age at maximum boundary (120)', () => {
        const result = patientAssessmentSchema.safeParse({ age: 120 });
        expect(result.success).toBe(true);
      });

      it('should reject age below minimum', () => {
        const result = patientAssessmentSchema.safeParse({ age: -1 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at least 0');
        }
      });

      it('should reject age above maximum', () => {
        const result = patientAssessmentSchema.safeParse({ age: 121 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at most 120');
        }
      });

      it('should accept null age', () => {
        const result = patientAssessmentSchema.safeParse({ age: null });
        expect(result.success).toBe(true);
      });

      it('should accept undefined age', () => {
        const result = patientAssessmentSchema.safeParse({});
        expect(result.success).toBe(true);
      });
    });

    describe('bp field (blood pressure)', () => {
      it('should accept valid bp values within range (30-200)', () => {
        const result = patientAssessmentSchema.safeParse({ bp: 120 });
        expect(result.success).toBe(true);
      });

      it('should accept bp at minimum boundary (30)', () => {
        const result = patientAssessmentSchema.safeParse({ bp: 30 });
        expect(result.success).toBe(true);
      });

      it('should accept bp at maximum boundary (200)', () => {
        const result = patientAssessmentSchema.safeParse({ bp: 200 });
        expect(result.success).toBe(true);
      });

      it('should reject bp below minimum', () => {
        const result = patientAssessmentSchema.safeParse({ bp: 29 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at least 30');
        }
      });

      it('should reject bp above maximum', () => {
        const result = patientAssessmentSchema.safeParse({ bp: 201 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at most 200');
        }
      });

      it('should accept null bp', () => {
        const result = patientAssessmentSchema.safeParse({ bp: null });
        expect(result.success).toBe(true);
      });
    });

    describe('sg field (specific gravity)', () => {
      it('should accept valid sg values within range (1.0-1.03)', () => {
        const result = patientAssessmentSchema.safeParse({ sg: 1.015 });
        expect(result.success).toBe(true);
      });

      it('should accept sg at minimum boundary (1.0)', () => {
        const result = patientAssessmentSchema.safeParse({ sg: 1.0 });
        expect(result.success).toBe(true);
      });

      it('should accept sg at maximum boundary (1.03)', () => {
        const result = patientAssessmentSchema.safeParse({ sg: 1.03 });
        expect(result.success).toBe(true);
      });

      it('should reject sg below minimum', () => {
        const result = patientAssessmentSchema.safeParse({ sg: 0.99 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at least 1.0');
        }
      });

      it('should reject sg above maximum', () => {
        const result = patientAssessmentSchema.safeParse({ sg: 1.04 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at most 1.03');
        }
      });
    });

    describe('bgr field (blood glucose random)', () => {
      it('should accept valid bgr values within range (0-600)', () => {
        const result = patientAssessmentSchema.safeParse({ bgr: 120 });
        expect(result.success).toBe(true);
      });

      it('should accept bgr at maximum boundary (600)', () => {
        const result = patientAssessmentSchema.safeParse({ bgr: 600 });
        expect(result.success).toBe(true);
      });

      it('should reject bgr above maximum', () => {
        const result = patientAssessmentSchema.safeParse({ bgr: 601 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at most 600');
        }
      });
    });

    describe('wc field (white blood cell count)', () => {
      it('should accept valid wc values within range (0-30000)', () => {
        const result = patientAssessmentSchema.safeParse({ wc: 8000 });
        expect(result.success).toBe(true);
      });

      it('should accept wc at maximum boundary (30000)', () => {
        const result = patientAssessmentSchema.safeParse({ wc: 30000 });
        expect(result.success).toBe(true);
      });

      it('should reject wc above maximum', () => {
        const result = patientAssessmentSchema.safeParse({ wc: 30001 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error!.issues[0]!.message).toBe('Value must be at most 30000');
        }
      });
    });
  });

  describe('Categorical Field Validation', () => {
    describe('rbc field (red blood cells)', () => {
      it('should accept "normal"', () => {
        const result = patientAssessmentSchema.safeParse({ rbc: 'normal' });
        expect(result.success).toBe(true);
      });

      it('should accept "abnormal"', () => {
        const result = patientAssessmentSchema.safeParse({ rbc: 'abnormal' });
        expect(result.success).toBe(true);
      });

      it('should accept null', () => {
        const result = patientAssessmentSchema.safeParse({ rbc: null });
        expect(result.success).toBe(true);
      });

      it('should reject invalid values', () => {
        const result = patientAssessmentSchema.safeParse({ rbc: 'invalid' });
        expect(result.success).toBe(false);
      });
    });

    describe('pcc field (pus cell clumps)', () => {
      it('should accept "present"', () => {
        const result = patientAssessmentSchema.safeParse({ pcc: 'present' });
        expect(result.success).toBe(true);
      });

      it('should accept "notpresent"', () => {
        const result = patientAssessmentSchema.safeParse({ pcc: 'notpresent' });
        expect(result.success).toBe(true);
      });

      it('should accept null', () => {
        const result = patientAssessmentSchema.safeParse({ pcc: null });
        expect(result.success).toBe(true);
      });

      it('should reject invalid values', () => {
        const result = patientAssessmentSchema.safeParse({ pcc: 'yes' });
        expect(result.success).toBe(false);
      });
    });

    describe('htn field (hypertension)', () => {
      it('should accept "yes"', () => {
        const result = patientAssessmentSchema.safeParse({ htn: 'yes' });
        expect(result.success).toBe(true);
      });

      it('should accept "no"', () => {
        const result = patientAssessmentSchema.safeParse({ htn: 'no' });
        expect(result.success).toBe(true);
      });

      it('should accept null', () => {
        const result = patientAssessmentSchema.safeParse({ htn: null });
        expect(result.success).toBe(true);
      });

      it('should reject invalid values', () => {
        const result = patientAssessmentSchema.safeParse({ htn: 'maybe' });
        expect(result.success).toBe(false);
      });
    });

    describe('appet field (appetite)', () => {
      it('should accept "good"', () => {
        const result = patientAssessmentSchema.safeParse({ appet: 'good' });
        expect(result.success).toBe(true);
      });

      it('should accept "poor"', () => {
        const result = patientAssessmentSchema.safeParse({ appet: 'poor' });
        expect(result.success).toBe(true);
      });

      it('should accept null', () => {
        const result = patientAssessmentSchema.safeParse({ appet: null });
        expect(result.success).toBe(true);
      });

      it('should reject invalid values', () => {
        const result = patientAssessmentSchema.safeParse({ appet: 'excellent' });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Complete Patient Assessment Validation', () => {
    it('should accept a complete valid patient assessment', () => {
      const validAssessment: PatientAssessmentFormData = {
        age: 45,
        bp: 140,
        sg: 1.015,
        al: 2,
        su: 1,
        bgr: 120,
        bu: 50,
        sc: 1.2,
        sod: 140,
        pot: 4.5,
        hemo: 14.5,
        pcv: 42,
        wc: 8000,
        rc: 5.2,
        rbc: 'normal',
        pc: 'abnormal',
        pcc: 'present',
        ba: 'notpresent',
        htn: 'yes',
        dm: 'no',
        cad: 'no',
        appet: 'good',
        pe: 'no',
        ane: 'no',
      };

      const result = patientAssessmentSchema.safeParse(validAssessment);
      expect(result.success).toBe(true);
    });

    it('should accept a patient assessment with all null values', () => {
      const result = patientAssessmentSchema.safeParse(defaultPatientAssessment);
      expect(result.success).toBe(true);
    });

    it('should accept a patient assessment with mixed null and valid values', () => {
      const mixedAssessment = {
        age: 45,
        bp: null,
        sg: 1.015,
        al: null,
        su: null,
        bgr: 120,
        bu: null,
        sc: null,
        sod: null,
        pot: null,
        hemo: null,
        pcv: null,
        wc: null,
        rc: null,
        rbc: 'normal',
        pc: null,
        pcc: null,
        ba: null,
        htn: 'yes',
        dm: null,
        cad: null,
        appet: null,
        pe: null,
        ane: null,
      };

      const result = patientAssessmentSchema.safeParse(mixedAssessment);
      expect(result.success).toBe(true);
    });

    it('should reject a patient assessment with multiple validation errors', () => {
      const invalidAssessment = {
        age: 150, // too high
        bp: 20, // too low
        sg: 0.5, // too low
        bgr: 700, // too high
        rbc: 'invalid', // invalid enum
        htn: 'maybe', // invalid enum
      };

      const result = patientAssessmentSchema.safeParse(invalidAssessment);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors
        expect(result.error.issues.length).toBeGreaterThan(1);
      }
    });
  });

  describe('validatePatientAssessment helper function', () => {
    it('should return success for valid data', () => {
      const result = validatePatientAssessment({ age: 45, bp: 120 });
      expect(result.success).toBe(true);
    });

    it('should return error for invalid data', () => {
      const result = validatePatientAssessment({ age: 150 });
      expect(result.success).toBe(false);
    });
  });

  describe('defaultPatientAssessment', () => {
    it('should have all fields set to null', () => {
      expect(defaultPatientAssessment.age).toBeNull();
      expect(defaultPatientAssessment.bp).toBeNull();
      expect(defaultPatientAssessment.sg).toBeNull();
      expect(defaultPatientAssessment.al).toBeNull();
      expect(defaultPatientAssessment.su).toBeNull();
      expect(defaultPatientAssessment.bgr).toBeNull();
      expect(defaultPatientAssessment.bu).toBeNull();
      expect(defaultPatientAssessment.sc).toBeNull();
      expect(defaultPatientAssessment.sod).toBeNull();
      expect(defaultPatientAssessment.pot).toBeNull();
      expect(defaultPatientAssessment.hemo).toBeNull();
      expect(defaultPatientAssessment.pcv).toBeNull();
      expect(defaultPatientAssessment.wc).toBeNull();
      expect(defaultPatientAssessment.rc).toBeNull();
      expect(defaultPatientAssessment.rbc).toBeNull();
      expect(defaultPatientAssessment.pc).toBeNull();
      expect(defaultPatientAssessment.pcc).toBeNull();
      expect(defaultPatientAssessment.ba).toBeNull();
      expect(defaultPatientAssessment.htn).toBeNull();
      expect(defaultPatientAssessment.dm).toBeNull();
      expect(defaultPatientAssessment.cad).toBeNull();
      expect(defaultPatientAssessment.appet).toBeNull();
      expect(defaultPatientAssessment.pe).toBeNull();
      expect(defaultPatientAssessment.ane).toBeNull();
    });

    it('should pass validation', () => {
      const result = patientAssessmentSchema.safeParse(defaultPatientAssessment);
      expect(result.success).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error message for out-of-range numeric value', () => {
      const result = patientAssessmentSchema.safeParse({ age: -5 });
      expect(result.success).toBe(false);
      if (!result.success) {
        const ageError = result.error.issues.find((issue) => issue.path[0] === 'age');
        expect(ageError?.message).toBe('Value must be at least 0');
      }
    });

    it('should provide clear error message for invalid enum value', () => {
      const result = patientAssessmentSchema.safeParse({ rbc: 'maybe' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const rbcError = result.error.issues.find((issue) => issue.path[0] === 'rbc');
        // Zod enum error message includes the expected values
        expect(rbcError?.message).toContain('normal');
        expect(rbcError?.message).toContain('abnormal');
      }
    });
  });

  describe('All Numeric Fields Range Validation', () => {
    it('should validate all numeric fields correctly', () => {
      const allNumericFields = {
        age: 45,
        bp: 120,
        sg: 1.015,
        al: 2,
        su: 1,
        bgr: 120,
        bu: 50,
        sc: 1.2,
        sod: 140,
        pot: 4.5,
        hemo: 14.5,
        pcv: 42,
        wc: 8000,
        rc: 5.2,
      };

      const result = patientAssessmentSchema.safeParse(allNumericFields);
      expect(result.success).toBe(true);
    });
  });

  describe('All Categorical Fields Enum Validation', () => {
    it('should validate all categorical fields correctly', () => {
      const allCategoricalFields = {
        rbc: 'normal',
        pc: 'abnormal',
        pcc: 'present',
        ba: 'notpresent',
        htn: 'yes',
        dm: 'no',
        cad: 'yes',
        appet: 'good',
        pe: 'no',
        ane: 'yes',
      };

      const result = patientAssessmentSchema.safeParse(allCategoricalFields);
      expect(result.success).toBe(true);
    });
  });
});

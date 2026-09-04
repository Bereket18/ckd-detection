import { describe, it, expect } from 'vitest';
import { MODEL_FIXTURE } from '../../tests/fixtures/api';
import type {
  PatientAssessment,
  PredictionResponse,
  ShapDriver,
  HealthResponse,
  BatchPredictionResponse,
  ApiStatus,
  UserMessage,
  FieldError,
} from './api.types';
import {
  isPredictionResponse,
  isHealthResponse,
  isBatchPredictionResponse,
} from './api.types';

describe('API Types', () => {
  describe('PatientAssessment', () => {
    it('should allow all fields to be null', () => {
      const assessment: PatientAssessment = {
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
      
      expect(assessment).toBeDefined();
    });

    it('should allow valid numeric and categorical values', () => {
      const assessment: PatientAssessment = {
        age: 45,
        bp: 120,
        sg: 1.02,
        al: 2,
        su: 0,
        bgr: 110,
        bu: 40,
        sc: 1.2,
        sod: 140,
        pot: 4.5,
        hemo: 15.0,
        pcv: 45,
        wc: 8000,
        rc: 5.2,
        rbc: 'normal',
        pc: 'abnormal',
        pcc: 'notpresent',
        ba: 'notpresent',
        htn: 'yes',
        dm: 'no',
        cad: 'no',
        appet: 'good',
        pe: 'no',
        ane: 'no',
      };
      
      expect(assessment.age).toBe(45);
      expect(assessment.rbc).toBe('normal');
    });
  });

  describe('ShapDriver', () => {
    it('should have required fields', () => {
      const driver: ShapDriver = {
        feature: 'age',
        value: 0.25,
        direction: 'raises_risk',
      };
      
      expect(driver.feature).toBe('age');
      expect(driver.value).toBe(0.25);
      expect(driver.direction).toBe('raises_risk');
    });

    it('should support all direction values', () => {
      const directions: Array<ShapDriver['direction']> = [
        'raises_risk',
        'lowers_risk',
        'neutral',
      ];
      
      expect(directions).toHaveLength(3);
    });
  });

  describe('PredictionResponse', () => {
    it('should have all required fields', () => {
      const response: PredictionResponse = {
        prediction: 'ckd',
        ckd_score: 0.85,
        risk_band: 'HIGH',
        imputed_fields: ['age', 'bp'],
        imputation_count: 2,
        shap_drivers: [
          { feature: 'sc', value: 0.3, direction: 'raises_risk' },
        ],
        explanation: 'High serum creatinine indicates kidney damage',
        model: MODEL_FIXTURE,
        disclaimer: 'This is for clinical decision support only',
      };
      
      expect(response.prediction).toBe('ckd');
      expect(response.risk_band).toBe('HIGH');
      expect(response.imputation_count).toBe(2);
    });
  });

  describe('HealthResponse', () => {
    it('should support ok status', () => {
      const health: HealthResponse = {
        status: 'ok',
        model: 'loaded',
        preprocessor: 'loaded',
        shap: 'loaded',
        schema_compatible: true,
        feature_count: 24,
        detail: null,
      };
      
      expect(health.status).toBe('ok');
      expect(health.feature_count).toBe(24);
    });

    it('should support degraded status', () => {
      const health: HealthResponse = {
        status: 'degraded',
        model: 'loaded',
        preprocessor: 'loaded',
        shap: 'missing',
        schema_compatible: true,
        feature_count: 24,
        detail: 'SHAP explainer not available',
      };
      
      expect(health.status).toBe('degraded');
      expect(health.detail).toBeDefined();
    });
  });

  describe('BatchPredictionResponse', () => {
    it('should contain count and results array', () => {
      const batch: BatchPredictionResponse = {
        count: 2,
        results: [
          {
            prediction: 'ckd',
            ckd_score: 0.85,
            risk_band: 'HIGH',
            imputed_fields: ['age'],
            imputation_count: 1,
            shap_drivers: [],
          },
          {
            prediction: 'notckd',
            ckd_score: 0.25,
            risk_band: 'LOW',
            imputed_fields: [],
            imputation_count: 0,
            shap_drivers: [],
          },
        ],
      };
      
      expect(batch.count).toBe(2);
      expect(batch.results).toHaveLength(2);
    });
  });

  describe('ApiStatus', () => {
    it('should support all status values', () => {
      const statuses: Array<ApiStatus['status']> = [
        'checking',
        'ok',
        'degraded',
        'offline',
      ];
      
      expect(statuses).toHaveLength(4);
    });
  });

  describe('UserMessage', () => {
    it('should support all message types', () => {
      const types: Array<UserMessage['type']> = [
        'success',
        'error',
        'warning',
        'info',
      ];
      
      expect(types).toHaveLength(4);
    });

    it('should have required fields', () => {
      const message: UserMessage = {
        type: 'error',
        title: 'Validation Failed',
        message: 'Age must be between 0 and 120',
      };
      
      expect(message.type).toBe('error');
      expect(message.title).toBeDefined();
      expect(message.message).toBeDefined();
    });
  });

  describe('FieldError', () => {
    it('should have field and message', () => {
      const error: FieldError = {
        field: 'age',
        message: 'Value must be at least 0',
      };
      
      expect(error.field).toBe('age');
      expect(error.message).toBeDefined();
    });
  });

  describe('Type Guards', () => {
    describe('isPredictionResponse', () => {
      it('should return true for valid PredictionResponse', () => {
        const data = {
          prediction: 'ckd',
          ckd_score: 0.85,
          risk_band: 'HIGH',
          shap_drivers: [],
          imputed_fields: [],
          imputation_count: 0,
          explanation: null,
          model: {},
          disclaimer: 'Test',
        };
        
        expect(isPredictionResponse(data)).toBe(true);
      });

      it('should return false for invalid data', () => {
        expect(isPredictionResponse(null)).toBe(false);
        expect(isPredictionResponse({})).toBe(false);
        expect(isPredictionResponse({ prediction: 'ckd' })).toBe(false);
      });
    });

    describe('isHealthResponse', () => {
      it('should return true for valid HealthResponse', () => {
        const data = {
          status: 'ok',
          model: 'loaded',
          schema_compatible: true,
          preprocessor: 'loaded',
          shap: 'loaded',
          feature_count: 24,
          detail: null,
        };
        
        expect(isHealthResponse(data)).toBe(true);
      });

      it('should return false for invalid data', () => {
        expect(isHealthResponse(null)).toBe(false);
        expect(isHealthResponse({})).toBe(false);
        expect(isHealthResponse({ status: 'ok' })).toBe(false);
      });
    });

    describe('isBatchPredictionResponse', () => {
      it('should return true for valid BatchPredictionResponse', () => {
        const data = {
          count: 2,
          results: [
            {
              prediction: 'ckd',
              ckd_score: 0.85,
              risk_band: 'HIGH',
              imputed_fields: [],
              imputation_count: 0,
              shap_drivers: [],
            },
          ],
        };
        
        expect(isBatchPredictionResponse(data)).toBe(true);
      });

      it('should return false for invalid data', () => {
        expect(isBatchPredictionResponse(null)).toBe(false);
        expect(isBatchPredictionResponse({})).toBe(false);
        expect(isBatchPredictionResponse({ count: 1 })).toBe(false);
        expect(isBatchPredictionResponse({ count: 1, results: 'not-array' })).toBe(false);
      });
    });
  });
});

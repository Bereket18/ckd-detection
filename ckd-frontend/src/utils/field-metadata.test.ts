/**
 * Unit Tests for Field Metadata Configuration
 */

import { describe, it, expect } from 'vitest';
import {
  FIELD_METADATA,
  SECTION_METADATA,
  getAllFieldNames,
  getFieldsBySection,
  getFieldMetadata,
  getSectionsInOrder,
  isNumericField,
  isCategoricalField,
  getFieldLabel,
  type FieldMetadata,
  type FieldSection,
} from './field-metadata';

describe('Field Metadata Configuration', () => {
  describe('FIELD_METADATA constant', () => {
    it('should contain all 24 clinical fields', () => {
      const fieldNames = Object.keys(FIELD_METADATA);
      expect(fieldNames).toHaveLength(24);
    });

    it('should have metadata for all expected fields', () => {
      const expectedFields = [
        'age', 'bp', 'sg', 'al', 'su', 'bgr', 'bu', 'sc', 'sod', 'pot',
        'hemo', 'pcv', 'wc', 'rc', 'rbc', 'pc', 'pcc', 'ba', 'htn', 'dm',
        'cad', 'appet', 'pe', 'ane',
      ];

      expectedFields.forEach((field) => {
        expect(FIELD_METADATA[field]).toBeDefined();
        expect(FIELD_METADATA[field]!.name).toBe(field);
      });
    });

    it('should have valid metadata structure for each field', () => {
      Object.values(FIELD_METADATA).forEach((field: FieldMetadata) => {
        expect(field.name).toBeTruthy();
        expect(field.label).toBeTruthy();
        expect(field.fullName).toBeTruthy();
        expect(['numeric', 'categorical']).toContain(field.type);
        expect(['demographics', 'lab_values', 'clinical_obs', 'medical_history']).toContain(field.section);
        expect(field.tooltip).toBeTruthy();
      });
    });

    it('should have min/max for all numeric fields', () => {
      const numericFields = Object.values(FIELD_METADATA).filter(
        (field) => field.type === 'numeric'
      );

      numericFields.forEach((field) => {
        expect(field.min).toBeDefined();
        expect(field.max).toBeDefined();
        expect(field.min).toBeLessThan(field.max!);
      });
    });

    it('should have options for all categorical fields', () => {
      const categoricalFields = Object.values(FIELD_METADATA).filter(
        (field) => field.type === 'categorical'
      );

      categoricalFields.forEach((field) => {
        expect(field.options).toBeDefined();
        expect(field.options!.length).toBeGreaterThan(0);
        
        field.options!.forEach((option) => {
          expect(option.value).toBeTruthy();
          expect(option.label).toBeTruthy();
        });
      });
    });
  });

  describe('SECTION_METADATA constant', () => {
    it('should contain all 4 sections', () => {
      const sections = Object.keys(SECTION_METADATA);
      expect(sections).toHaveLength(4);
    });

    it('should have metadata for all expected sections', () => {
      const expectedSections: FieldSection[] = [
        'demographics',
        'lab_values',
        'clinical_obs',
        'medical_history',
      ];

      expectedSections.forEach((section) => {
        expect(SECTION_METADATA[section]).toBeDefined();
        expect(SECTION_METADATA[section].key).toBe(section);
        expect(SECTION_METADATA[section].title).toBeTruthy();
        expect(SECTION_METADATA[section].description).toBeTruthy();
        expect(SECTION_METADATA[section].order).toBeGreaterThan(0);
      });
    });

    it('should have unique order values for each section', () => {
      const orders = Object.values(SECTION_METADATA).map((s) => s.order);
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBe(orders.length);
    });
  });

  describe('getAllFieldNames()', () => {
    it('should return all 24 field names', () => {
      const names = getAllFieldNames();
      expect(names).toHaveLength(24);
    });

    it('should return field names that exist in FIELD_METADATA', () => {
      const names = getAllFieldNames();
      names.forEach((name) => {
        expect(FIELD_METADATA[name]).toBeDefined();
      });
    });
  });

  describe('getFieldsBySection()', () => {
    it('should return fields grouped by section', () => {
      const grouped = getFieldsBySection();
      
      expect(grouped.demographics).toBeDefined();
      expect(grouped.lab_values).toBeDefined();
      expect(grouped.clinical_obs).toBeDefined();
      expect(grouped.medical_history).toBeDefined();
    });

    it('should place all 24 fields into sections', () => {
      const grouped = getFieldsBySection();
      const totalFields =
        grouped.demographics.length +
        grouped.lab_values.length +
        grouped.clinical_obs.length +
        grouped.medical_history.length;
      
      expect(totalFields).toBe(24);
    });

    it('should group demographics fields correctly', () => {
      const grouped = getFieldsBySection();
      expect(grouped.demographics).toHaveLength(2);
      
      const fieldNames = grouped.demographics.map((f) => f.name);
      expect(fieldNames).toContain('age');
      expect(fieldNames).toContain('bp');
    });

    it('should group lab_values fields correctly', () => {
      const grouped = getFieldsBySection();
      expect(grouped.lab_values).toHaveLength(12);
      
      const fieldNames = grouped.lab_values.map((f) => f.name);
      expect(fieldNames).toContain('sg');
      expect(fieldNames).toContain('sc');
      expect(fieldNames).toContain('hemo');
    });

    it('should group clinical_obs fields correctly', () => {
      const grouped = getFieldsBySection();
      expect(grouped.clinical_obs).toHaveLength(4);
      
      const fieldNames = grouped.clinical_obs.map((f) => f.name);
      expect(fieldNames).toContain('rbc');
      expect(fieldNames).toContain('pc');
      expect(fieldNames).toContain('pcc');
      expect(fieldNames).toContain('ba');
    });

    it('should group medical_history fields correctly', () => {
      const grouped = getFieldsBySection();
      expect(grouped.medical_history).toHaveLength(6);
      
      const fieldNames = grouped.medical_history.map((f) => f.name);
      expect(fieldNames).toContain('htn');
      expect(fieldNames).toContain('dm');
      expect(fieldNames).toContain('ane');
    });
  });

  describe('getFieldMetadata()', () => {
    it('should return metadata for valid field name', () => {
      const metadata = getFieldMetadata('age');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('age');
    });

    it('should return undefined for invalid field name', () => {
      const metadata = getFieldMetadata('invalid_field');
      expect(metadata).toBeUndefined();
    });
  });

  describe('getSectionsInOrder()', () => {
    it('should return sections in ascending order', () => {
      const sections = getSectionsInOrder();
      expect(sections).toHaveLength(4);
      
      for (let i = 1; i < sections.length; i++) {
        expect(sections[i].order).toBeGreaterThan(sections[i - 1].order);
      }
    });

    it('should start with demographics section', () => {
      const sections = getSectionsInOrder();
      expect(sections[0]!.key).toBe('demographics');
    });
  });

  describe('isNumericField()', () => {
    it('should return true for numeric fields', () => {
      expect(isNumericField('age')).toBe(true);
      expect(isNumericField('bp')).toBe(true);
      expect(isNumericField('sc')).toBe(true);
    });

    it('should return false for categorical fields', () => {
      expect(isNumericField('rbc')).toBe(false);
      expect(isNumericField('htn')).toBe(false);
      expect(isNumericField('appet')).toBe(false);
    });
  });

  describe('isCategoricalField()', () => {
    it('should return true for categorical fields', () => {
      expect(isCategoricalField('rbc')).toBe(true);
      expect(isCategoricalField('htn')).toBe(true);
      expect(isCategoricalField('dm')).toBe(true);
    });

    it('should return false for numeric fields', () => {
      expect(isCategoricalField('age')).toBe(false);
      expect(isCategoricalField('bp')).toBe(false);
      expect(isCategoricalField('sc')).toBe(false);
    });
  });

  describe('getFieldLabel()', () => {
    it('should format label with abbreviation, full name, and unit', () => {
      const label = getFieldLabel('bp');
      expect(label).toContain('BP');
      expect(label).toContain('Blood Pressure');
      expect(label).toContain('mmHg');
    });

    it('should format label without unit for fields without units', () => {
      const label = getFieldLabel('age');
      expect(label).toContain('Age');
      expect(label).toContain('Patient Age');
    });

    it('should return field name for invalid field', () => {
      const label = getFieldLabel('invalid_field');
      expect(label).toBe('invalid_field');
    });
  });

  describe('Field Validation Ranges', () => {
    it('should have correct range for age', () => {
      const field = FIELD_METADATA.age;
      expect(field.min).toBe(0);
      expect(field.max).toBe(120);
    });

    it('should have correct range for blood pressure', () => {
      const field = FIELD_METADATA.bp;
      expect(field.min).toBe(30);
      expect(field.max).toBe(200);
    });

    it('should have correct range for serum creatinine', () => {
      const field = FIELD_METADATA.sc;
      expect(field.min).toBe(0);
      expect(field.max).toBe(80);
    });

    it('should have correct range for specific gravity', () => {
      const field = FIELD_METADATA.sg;
      expect(field.min).toBe(1.0);
      expect(field.max).toBe(1.03);
    });
  });

  describe('Categorical Options', () => {
    it('should have correct options for binary yes/no fields', () => {
      const fields = ['htn', 'dm', 'cad', 'pe', 'ane'];
      
      fields.forEach((fieldName) => {
        const field = FIELD_METADATA[fieldName];
        expect(field.options).toHaveLength(2);
        
        const values = field.options!.map((o) => o.value);
        expect(values).toContain('yes');
        expect(values).toContain('no');
      });
    });

    it('should have correct options for normal/abnormal fields', () => {
      const fields = ['rbc', 'pc'];
      
      fields.forEach((fieldName) => {
        const field = FIELD_METADATA[fieldName];
        expect(field.options).toHaveLength(2);
        
        const values = field.options!.map((o) => o.value);
        expect(values).toContain('normal');
        expect(values).toContain('abnormal');
      });
    });

    it('should have correct options for present/notpresent fields', () => {
      const fields = ['pcc', 'ba'];
      
      fields.forEach((fieldName) => {
        const field = FIELD_METADATA[fieldName];
        expect(field.options).toHaveLength(2);
        
        const values = field.options!.map((o) => o.value);
        expect(values).toContain('present');
        expect(values).toContain('notpresent');
      });
    });

    it('should have correct options for appetite field', () => {
      const field = FIELD_METADATA.appet;
      expect(field.options).toHaveLength(2);
      
      const values = field.options!.map((o) => o.value);
      expect(values).toContain('good');
      expect(values).toContain('poor');
    });
  });

  describe('Tooltips', () => {
    it('should have non-empty tooltips for all fields', () => {
      Object.values(FIELD_METADATA).forEach((field) => {
        expect(field.tooltip.length).toBeGreaterThan(20);
      });
    });

    it('should have clinical context in tooltips', () => {
      const ageTooltip = FIELD_METADATA.age!.tooltip;
      expect(ageTooltip.toLowerCase()).toContain('ckd');

      const scTooltip = FIELD_METADATA.sc!.tooltip;
      expect(scTooltip.toLowerCase()).toContain('kidney');
    });
  });
});

# Types Directory

This directory contains TypeScript type definitions and validation schemas for the CKD Frontend application.

## Files

### `api.types.ts`
Contains TypeScript interfaces that mirror the backend API schemas defined in `api/schemas.py`. These types ensure type safety when communicating with the FastAPI backend.

**Key Types:**
- `PatientAssessment` - Input schema for patient clinical data (24 fields)
- `PredictionResponse` - API response containing prediction results
- `ShapDriver` - Feature contribution to prediction
- `HealthResponse` - API health check response
- `BatchPredictionResponse` - Batch prediction results

### `validation.schema.ts`
Contains Zod validation schemas for form validation with React Hook Form.

**Key Exports:**
- `patientAssessmentSchema` - Zod schema for validating patient assessment data
- `PatientAssessmentFormData` - TypeScript type inferred from schema
- `validatePatientAssessment()` - Helper function for manual validation
- `defaultPatientAssessment` - Default form values (all null)

**Usage with React Hook Form:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { patientAssessmentSchema, type PatientAssessmentFormData } from './types';

const { register, handleSubmit, formState: { errors } } = useForm<PatientAssessmentFormData>({
  resolver: zodResolver(patientAssessmentSchema),
  defaultValues: defaultPatientAssessment,
});
```

**Validation Rules:**

Numeric fields with ranges:
- `age`: 0-120 years
- `bp`: 30-200 mmHg
- `sg`: 1.0-1.03
- `al`: 0-5
- `su`: 0-5
- `bgr`: 0-600 mg/dL
- `bu`: 0-400 mg/dL
- `sc`: 0-80 mg/dL
- `sod`: 0-200 mEq/L
- `pot`: 0-50 mEq/L
- `hemo`: 0-25 gms
- `pcv`: 0-60
- `wc`: 0-30000 cells/cumm
- `rc`: 0-10 millions/cmm

Categorical fields with enums:
- `rbc`, `pc`: "normal" | "abnormal"
- `pcc`, `ba`: "present" | "notpresent"
- `htn`, `dm`, `cad`, `pe`, `ane`: "yes" | "no"
- `appet`: "good" | "poor"

All fields are nullable to support missing data (handled by backend imputation).

### `index.ts`
Central export point for all types and validation schemas. Import types from this file:

```typescript
import { 
  PatientAssessment,
  PredictionResponse,
  patientAssessmentSchema,
  type PatientAssessmentFormData
} from './types';
```

## Testing

Validation schema tests are located in `validation.schema.test.ts`. Run tests with:
```bash
npm test -- validation.schema.test.ts
```

## References

- Backend API Schema: `api/schemas.py`
- Authoritative requirements: `FRONTEND_PLAN.md`
- Authoritative design: `FRONTEND_ARCHITECTURE.md`
- Superseded originals, kept for history only: `docs/archive/frontend-spec/design.md` and
  `docs/archive/frontend-spec/requirements.md`

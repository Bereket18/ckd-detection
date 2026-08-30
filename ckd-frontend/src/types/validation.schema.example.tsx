/**
 * Example: Using Zod Validation Schema with React Hook Form
 * 
 * This file demonstrates how to use the patient assessment validation schema
 * with React Hook Form for the CKD assessment form.
 * 
 * Delete this file after implementation or use it as a reference.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  patientAssessmentSchema,
  defaultPatientAssessment,
  type PatientAssessmentFormData,
} from './validation.schema';

/**
 * Example Component: Patient Assessment Form
 */
function ExampleAssessmentForm() {
  // Initialize React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset,
  } = useForm<PatientAssessmentFormData>({
    resolver: zodResolver(patientAssessmentSchema),
    defaultValues: defaultPatientAssessment,
    mode: 'onChange', // Validate on every change for real-time feedback
  });

  // Handle form submission
  const onSubmit = async (data: PatientAssessmentFormData) => {
    try {
      console.log('Form data:', data);
      // Call API with validated data
      // const response = await apiClient.predictSingle(data);
      // handleSuccess(response);
    } catch (error) {
      console.error('Submission error:', error);
      // handleError(error);
    }
  };

  // Handle form reset
  const handleReset = () => {
    reset(defaultPatientAssessment);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Example: Numeric Input Field */}
      <div>
        <label htmlFor="age">Age (years)</label>
        <input
          id="age"
          type="number"
          {...register('age', { valueAsNumber: true })}
          placeholder="0-120"
        />
        {errors.age && <span className="error">{errors.age.message}</span>}
      </div>

      {/* Example: Numeric Input with Decimal */}
      <div>
        <label htmlFor="sg">Specific Gravity</label>
        <input
          id="sg"
          type="number"
          step="0.001"
          {...register('sg', { valueAsNumber: true })}
          placeholder="1.0-1.03"
        />
        {errors.sg && <span className="error">{errors.sg.message}</span>}
      </div>

      {/* Example: Categorical Select Field */}
      <div>
        <label htmlFor="rbc">Red Blood Cells</label>
        <select id="rbc" {...register('rbc')}>
          <option value="">Not provided</option>
          <option value="normal">Normal</option>
          <option value="abnormal">Abnormal</option>
        </select>
        {errors.rbc && <span className="error">{errors.rbc.message}</span>}
      </div>

      {/* Example: Yes/No Select Field */}
      <div>
        <label htmlFor="htn">Hypertension</label>
        <select id="htn" {...register('htn')}>
          <option value="">Not provided</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
        {errors.htn && <span className="error">{errors.htn.message}</span>}
      </div>

      {/* Submit and Reset Buttons */}
      <div>
        <button type="submit" disabled={isSubmitting || !isValid}>
          {isSubmitting ? 'Analyzing...' : 'Submit Assessment'}
        </button>
        <button type="button" onClick={handleReset}>
          Reset Form
        </button>
      </div>

      {/* Display validation error count */}
      {Object.keys(errors).length > 0 && (
        <div className="error-summary">
          Fix {Object.keys(errors).length} error{Object.keys(errors).length !== 1 ? 's' : ''} to
          submit
        </div>
      )}
    </form>
  );
}

/**
 * Example: Manual Validation (without React Hook Form)
 */
function exampleManualValidation() {
  const patientData = {
    age: 45,
    bp: 140,
    sg: 1.015,
    rbc: 'normal',
    htn: 'yes',
    // ... other fields
  };

  // Validate using the helper function
  const result = patientAssessmentSchema.safeParse(patientData);

  if (result.success) {
    console.log('Valid data:', result.data);
    // Proceed with API call
  } else {
    console.error('Validation errors:', result.error.issues);
    // Display errors to user
    result.error.issues.forEach((issue) => {
      console.log(`Field: ${issue.path.join('.')}, Error: ${issue.message}`);
    });
  }
}

/**
 * Example: Transforming null values for API submission
 * 
 * Note: The API expects null for missing fields, which is already handled
 * by the schema. React Hook Form will automatically preserve null values.
 */
function exampleAPITransformation(formData: PatientAssessmentFormData) {
  // FormData already has null for missing fields, ready for API submission
  const apiPayload = formData;

  console.log('API Payload:', apiPayload);
  // POST to /predict endpoint
  // fetch('http://localhost:8000/predict', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(apiPayload),
  // });
}

export { ExampleAssessmentForm, exampleManualValidation, exampleAPITransformation };

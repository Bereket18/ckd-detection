# Requirements Document

## Introduction

The EthioCKD Clinical API requires a web-based frontend that enables clinicians to assess chronic kidney disease (CKD) risk for patients through a user-friendly interface. The frontend shall connect to the existing FastAPI backend (running on localhost with CORS configured for port 5173), allow clinicians to input patient clinical data across 24 features, submit assessments to the API, and display predictions with risk bands and explainability information. The system must handle both complete and incomplete patient data (missing values are imputed by the backend model), provide clear visualizations of risk factors using SHAP driver data, and maintain data validation to ensure clinical accuracy.

## Glossary

- **Frontend_App**: The React-based single-page web application that clinicians interact with
- **API_Client**: The module responsible for HTTP communication with the FastAPI backend
- **Assessment_Form**: The UI component collecting the 24 patient clinical features
- **Results_Display**: The UI component showing prediction outcomes, risk bands, and explanations
- **Risk_Band**: A categorical assessment of CKD risk (LOW, MODERATE, or HIGH)
- **SHAP_Driver**: An explainability feature showing which clinical values raised or lowered risk
- **Imputed_Field**: A clinical feature that was missing in input and filled by the model
- **CKD_Score**: A numeric confidence value between 0 and 1 indicating likelihood of CKD
- **Prediction**: The binary classification result (ckd or notckd)
- **Health_Monitor**: Component that verifies API availability before allowing assessments

## Requirements

### Requirement 1: Patient Assessment Input

**User Story:** As a clinician, I want to input patient clinical data through a structured form, so that I can obtain a CKD risk assessment.

#### Acceptance Criteria

1. THE Assessment_Form SHALL display input fields for all 24 clinical features defined in the PatientAssessment schema
2. THE Assessment_Form SHALL group related features into logical sections (demographics, lab values, clinical observations, medical history)
3. THE Assessment_Form SHALL accept numeric input fields with validation ranges matching the API schema (age: 0-120, bp: 30-200, sg: 1.0-1.03, al: 0-5, su: 0-5, bgr: 0-600, bu: 0-400, sc: 0-80, sod: 0-200, pot: 0-50, hemo: 0-25, pcv: 0-60, wc: 0-30000, rc: 0-10)
4. THE Assessment_Form SHALL provide dropdown selections for categorical features with exact API values (rbc: normal/abnormal, pc: normal/abnormal, pcc: present/notpresent, ba: present/notpresent, htn: yes/no, dm: yes/no, cad: yes/no, appet: good/poor, pe: yes/no, ane: yes/no)
5. THE Assessment_Form SHALL allow all fields to remain empty to represent missing data
6. WHEN a numeric field receives input outside its valid range, THE Assessment_Form SHALL display a validation error message
7. WHEN the clinician submits the form, THE Assessment_Form SHALL send a POST request to the /predict endpoint with all field values

### Requirement 2: API Communication

**User Story:** As a clinician, I want the frontend to reliably communicate with the backend API, so that patient assessments are processed correctly.

#### Acceptance Criteria

1. THE API_Client SHALL send POST requests to http://localhost:8000/predict with Content-Type application/json
2. THE API_Client SHALL include null values for empty form fields in the request payload
3. WHEN the API returns a 200 response, THE API_Client SHALL parse the PredictionResponse schema
4. WHEN the API returns a 422 validation error, THE API_Client SHALL display field-specific error messages to the clinician
5. WHEN the API returns a 500 server error, THE API_Client SHALL display a generic error message and suggest retrying
6. WHEN the API request times out after 30 seconds, THE API_Client SHALL display a timeout error message
7. THE API_Client SHALL handle network failures and display an offline error message

### Requirement 3: Prediction Results Display

**User Story:** As a clinician, I want to see clear CKD risk assessment results with explanations, so that I can understand the diagnosis and communicate it to patients.

#### Acceptance Criteria

1. THE Results_Display SHALL show the binary prediction (CKD or Not CKD) prominently with visual distinction
2. THE Results_Display SHALL display the risk_band value with color coding (LOW: green, MODERATE: yellow, HIGH: red)
3. THE Results_Display SHALL show the ckd_score as a percentage with one decimal place
4. THE Results_Display SHALL list all imputed_fields with a warning icon if imputation_count is greater than 0
5. THE Results_Display SHALL display up to 5 SHAP_Drivers with feature names, values, and direction indicators (raises_risk: up arrow, lowers_risk: down arrow, neutral: dash)
6. THE Results_Display SHALL show the model disclaimer text from the API response
7. THE Results_Display SHALL provide a button to start a new assessment that clears previous results

### Requirement 4: SHAP Explainability Visualization

**User Story:** As a clinician, I want to understand which clinical factors contributed to the CKD risk assessment, so that I can make informed treatment decisions.

#### Acceptance Criteria

1. THE Results_Display SHALL render SHAP drivers in descending order of absolute impact
2. WHEN a SHAP_Driver direction is raises_risk, THE Results_Display SHALL display it with a red indicator
3. WHEN a SHAP_Driver direction is lowers_risk, THE Results_Display SHALL display it with a green indicator
4. WHEN a SHAP_Driver direction is neutral, THE Results_Display SHALL display it with a gray indicator
5. THE Results_Display SHALL show the feature name and the actual patient value for each driver
6. THE Results_Display SHALL include a tooltip explaining what SHAP values represent

### Requirement 5: Health Check and API Status

**User Story:** As a clinician, I want to know if the API is available before submitting assessments, so that I don't waste time entering data when the system is down.

#### Acceptance Criteria

1. WHEN the Frontend_App loads, THE Health_Monitor SHALL send a GET request to /health
2. WHEN the health endpoint returns status "ok", THE Health_Monitor SHALL enable the Assessment_Form
3. WHEN the health endpoint returns status "degraded", THE Health_Monitor SHALL display a warning banner and disable the Assessment_Form
4. WHEN the health endpoint is unreachable, THE Health_Monitor SHALL display an error banner stating the API is offline
5. THE Health_Monitor SHALL retry the health check every 60 seconds while status is not "ok"
6. THE Frontend_App SHALL display the model name and feature_count from the health response when available

### Requirement 6: Form Validation and User Guidance

**User Story:** As a clinician, I want clear validation feedback and field descriptions, so that I can enter patient data accurately.

#### Acceptance Criteria

1. THE Assessment_Form SHALL display field labels with medical abbreviations and full names (e.g., "BP - Blood Pressure (mmHg)")
2. THE Assessment_Form SHALL show validation errors inline below each field
3. WHEN a required numeric field contains non-numeric text, THE Assessment_Form SHALL display "Must be a valid number"
4. WHEN a numeric field value is below the minimum, THE Assessment_Form SHALL display "Value must be at least X"
5. WHEN a numeric field value exceeds the maximum, THE Assessment_Form SHALL display "Value must be at most X"
6. THE Assessment_Form SHALL disable the submit button until all validation errors are resolved
7. THE Assessment_Form SHALL display a tooltip with clinical context for each field on hover

### Requirement 7: Responsive Layout and Accessibility

**User Story:** As a clinician, I want the interface to work on different screen sizes and be accessible, so that I can use it on tablets or desktops in clinical settings.

#### Acceptance Criteria

1. THE Frontend_App SHALL render a responsive layout that adapts to viewport widths from 768px to 1920px
2. THE Frontend_App SHALL use a single-column layout on screens narrower than 768px
3. THE Assessment_Form SHALL use a two-column grid layout on screens wider than 1024px
4. THE Frontend_App SHALL maintain a minimum font size of 14px for body text
5. THE Frontend_App SHALL ensure color contrast ratios meet WCAG 2.1 AA standards (4.5:1 for normal text)
6. THE Frontend_App SHALL provide keyboard navigation for all interactive elements
7. THE Frontend_App SHALL include ARIA labels for screen reader accessibility on all form inputs and buttons

### Requirement 8: Batch Assessment Upload

**User Story:** As a clinician, I want to upload multiple patient assessments from a CSV file, so that I can process screening data efficiently.

#### Acceptance Criteria

1. THE Frontend_App SHALL provide a file upload component accepting CSV files
2. WHEN a CSV file is selected, THE API_Client SHALL send a POST request to /predict/batch with Content-Type text/csv
3. THE API_Client SHALL read the CSV file content and send it in the request body
4. WHEN the batch prediction succeeds, THE Results_Display SHALL show a summary table with count and results
5. THE Results_Display SHALL display each batch result row with prediction, ckd_score, risk_band, and imputation_count
6. THE Results_Display SHALL allow exporting batch results as a CSV file with all prediction columns appended
7. WHEN a CSV upload fails validation, THE Frontend_App SHALL display row-level error messages indicating which rows failed

### Requirement 9: Loading States and User Feedback

**User Story:** As a clinician, I want to see clear loading indicators during API requests, so that I know the system is processing my input.

#### Acceptance Criteria

1. WHEN the Assessment_Form is submitted, THE Frontend_App SHALL display a loading spinner on the submit button
2. WHEN the Assessment_Form is submitted, THE Frontend_App SHALL disable all form inputs until the response is received
3. WHEN a prediction request is in progress, THE Frontend_App SHALL display a message "Analyzing patient data..."
4. WHEN a prediction request completes successfully, THE Frontend_App SHALL hide the loading indicator and show results
5. WHEN a prediction request fails, THE Frontend_App SHALL hide the loading indicator and display an error alert
6. THE Frontend_App SHALL show a progress indicator during CSV file uploads
7. THE Frontend_App SHALL provide visual feedback (color change or animation) when the submit button is clicked

### Requirement 10: Model Metadata Display

**User Story:** As a clinician, I want to see which model version is being used for predictions, so that I can trust the system's reliability.

#### Acceptance Criteria

1. WHEN the Frontend_App loads, THE API_Client SHALL send a GET request to /model
2. THE Frontend_App SHALL display model metadata in a footer or information panel
3. THE Frontend_App SHALL show the model accuracy, recall, and precision metrics when available
4. THE Frontend_App SHALL display the model training date if provided by the API
5. THE Frontend_App SHALL show the feature count used by the model
6. THE Frontend_App SHALL provide a link or button to view the full model card
7. THE Frontend_App SHALL update model metadata whenever the health check detects a model change


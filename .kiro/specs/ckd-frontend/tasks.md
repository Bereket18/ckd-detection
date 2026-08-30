# Implementation Plan: CKD Frontend

## Overview

This plan implements a standalone React + TypeScript single-page application for CKD risk assessment. The frontend will be completely independent from the backend API, enabling the API to be reused by bots, mobile apps, and other clients. The implementation follows a component-based architecture with comprehensive validation, error handling, and accessibility support.

## Tasks

- [x] 1. Set up project structure and development environment
  - Create new React project with Vite and TypeScript in `ckd-frontend/` directory (separate from backend)
  - Configure TypeScript with strict mode and React types
  - Set up Vitest and React Testing Library for testing
  - Configure ESLint and Prettier for code quality
  - Create project folder structure (components/, services/, types/, utils/, hooks/, styles/)
  - Install dependencies: react-hook-form, zod, react-testing-library, msw, vitest
  - Configure Vite dev server for port 5173 with API proxy to localhost:8000
  - Create environment configuration files (.env.development, .env.production)
  - _Requirements: 2.1, 5.1, 9.1_

- [x] 2. Define TypeScript types and validation schemas
  - [x] 2.1 Create API response types
    - Define PatientAssessment interface matching all 24 API fields
    - Define PredictionResponse interface with prediction, ckd_score, risk_band, imputed_fields, shap_drivers
    - Define ShapDriver interface with feature, value, direction
    - Define HealthResponse interface with status, model, feature_count
    - Define BatchPredictionResponse and BatchPredictionItem interfaces
    - Define ModelInfo, ApiStatus, UserMessage, and FieldError types
    - _Requirements: 1.1, 1.4, 3.1, 5.2_
  
  - [x] 2.2 Create Zod validation schema for patient assessment
    - Define numeric field validators with min/max ranges (age: 0-120, bp: 30-200, etc.)
    - Define categorical field validators with enum values (rbc: normal/abnormal, etc.)
    - Allow null values for all fields to handle missing data
    - Export validation schema for use with React Hook Form
    - _Requirements: 1.3, 1.5, 1.6, 6.3, 6.4, 6.5_
  
  - [x] 2.3 Create field metadata configuration
    - Define FieldMetadata interface with name, label, type, unit, min, max, options, section, tooltip
    - Create FIELD_METADATA constant with all 24 fields mapped to their metadata
    - Group fields by section: demographics, lab_values, clinical_obs, medical_history
    - Include clinical tooltips and full names for each field
    - _Requirements: 1.2, 6.1, 6.7_

- [ ] 3. Implement API client service
  - [-] 3.1 Create base APIClient class
    - Implement HTTP wrapper with fetch API
    - Configure base URL from environment variable (http://localhost:8000)
    - Set request timeout to 30 seconds
    - Implement GET and POST methods with error handling
    - Add request/response interceptors for logging
    - _Requirements: 2.1, 2.6_
  
  - [x] 3.2 Implement API endpoint methods
    - Add checkHealth() method for GET /health
    - Add getModelMetadata() method for GET /model
    - Add predictSingle() method for POST /predict with PatientAssessment payload
    - Add predictBatch() method for POST /predict/batch with CSV content
    - Ensure all methods return properly typed responses
    - _Requirements: 2.1, 2.3, 5.1, 8.2, 10.1_
  
  - [x] 3.3 Implement error handling and mapping
    - Map HTTP 422 validation errors to field-specific messages
    - Map HTTP 500 errors to user-friendly server error messages
    - Handle network timeouts with specific timeout error messages
    - Handle network failures with offline error messages
    - Create ErrorHandler class with handleAPIError and handleValidationError methods
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 9.5_

- [ ] 4. Build reusable form input components
  - [-] 4.1 Create NumericInput component
    - Accept props: name, label, unit, min, max, tooltip, error, value, onChange
    - Render input with type="number" and validation attributes
    - Display unit label next to input (e.g., "mmHg")
    - Show inline error message below input when error prop is set
    - Display tooltip on hover with clinical context
    - Add clear button to set value to null
    - Style with validation states (error border, focus states)
    - _Requirements: 1.3, 6.2, 6.7_
  
  - [ ]* 4.2 Write unit tests for NumericInput
    - Test validation error display when value is out of range
    - Test onChange callback is called with correct value
    - Test unit label is displayed when provided
    - Test clear button sets value to null
    - Test tooltip appears on hover
    - _Requirements: 6.2, 6.4, 6.5_
  
  - [ ] 4.3 Create CategoricalSelect component
    - Accept props: name, label, options, tooltip, error, value, onChange
    - Render select dropdown with options from props
    - Include "Not provided" option that sets value to null
    - Show inline error message below select when error prop is set
    - Display tooltip on hover
    - Add keyboard navigation support (Arrow keys)
    - Add ARIA labels for screen reader accessibility
    - _Requirements: 1.4, 6.7, 7.6, 7.7_
  
  - [ ]* 4.4 Write unit tests for CategoricalSelect
    - Test option selection updates value
    - Test "Not provided" option sets value to null
    - Test keyboard navigation with arrow keys
    - Test ARIA labels are present
    - _Requirements: 7.6, 7.7_
  
  - [-] 4.5 Create FormSection component
    - Accept props: title, description, children, collapsible
    - Render section header with title
    - Render description text below title if provided
    - Render children components in a responsive grid
    - Add optional collapse/expand functionality
    - _Requirements: 1.2_

- [ ] 5. Implement patient assessment form
  - [ ] 5.1 Create AssessmentForm component structure
    - Set up React Hook Form with Zod validation schema
    - Create form state for all 24 patient fields
    - Implement handleSubmit function to call onSubmit prop
    - Add loading state to disable form during submission
    - Implement resetForm function to clear all fields
    - _Requirements: 1.1, 1.7, 9.1, 9.2_
  
  - [ ] 5.2 Render form sections with grouped fields
    - Create Demographics section with age, bp inputs
    - Create Lab Values section with sg, al, su, bgr, bu, sc, sod, pot, hemo, pcv, wc, rc inputs
    - Create Clinical Observations section with rbc, pc, pcc, ba selects
    - Create Medical History section with htn, dm, cad, appet, pe, ane selects
    - Use FormSection component to organize each group
    - Apply responsive grid layout (1 column mobile, 2 columns tablet, 3 columns desktop)
    - _Requirements: 1.2, 7.2, 7.3_
  
  - [ ] 5.3 Implement real-time field validation
    - Connect Zod schema to React Hook Form validation
    - Display validation errors inline below each field
    - Show "Must be a valid number" for non-numeric input in numeric fields
    - Show "Value must be at least X" for values below minimum
    - Show "Value must be at most X" for values exceeding maximum
    - Disable submit button when validation errors exist
    - Update submit button text to show error count when errors present
    - _Requirements: 1.6, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ] 5.4 Implement form submission
    - Validate form data against Zod schema on submit
    - Call API_Client.predictSingle() with form data
    - Handle null values correctly for missing fields
    - Display loading spinner on submit button during request
    - Pass prediction response to Results_Display component
    - Handle API errors and display error messages
    - _Requirements: 1.7, 2.2, 9.1, 9.2, 9.3_
  
  - [ ]* 5.5 Write integration tests for assessment form
    - Test form submission with valid data calls API endpoint
    - Test validation errors prevent submission
    - Test loading state disables form during submission
    - Test error handling displays error messages
    - Mock API responses with MSW (Mock Service Worker)
    - _Requirements: 1.6, 1.7, 9.1, 9.2, 9.5_

- [ ] 6. Checkpoint - Ensure form submission works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Build prediction results display components
  - [ ] 7.1 Create PredictionBadge component
    - Accept props: prediction ('ckd' | 'notckd')
    - Render large badge with "CKD" or "Not CKD" text
    - Apply distinct styling for each prediction (red for CKD, green for Not CKD)
    - Add icon next to text (warning icon for CKD, checkmark for Not CKD)
    - _Requirements: 3.1_
  
  - [ ] 7.2 Create RiskBandIndicator component
    - Accept props: risk_band ('LOW' | 'MODERATE' | 'HIGH')
    - Render color-coded indicator (green for LOW, yellow for MODERATE, red for HIGH)
    - Display risk band label prominently
    - Add visual bar or progress indicator showing relative risk level
    - _Requirements: 3.2_
  
  - [ ]* 7.3 Write unit tests for RiskBandIndicator
    - Test LOW risk band displays green styling
    - Test MODERATE risk band displays yellow styling
    - Test HIGH risk band displays red styling
    - Test risk band label is displayed correctly
    - _Requirements: 3.2_
  
  - [ ] 7.4 Create ImputationWarning component
    - Accept props: imputed_fields (string[]), imputation_count (number)
    - Render warning banner when imputation_count > 0
    - List all imputed field names with warning icon
    - Display message explaining what imputation means
    - Apply warning styling (yellow/orange background)
    - _Requirements: 3.4_
  
  - [ ] 7.5 Create ShapDriverItem component
    - Accept props: driver (ShapDriver with feature, value, direction)
    - Render horizontal bar showing relative impact
    - Display feature name and patient value
    - Add direction icon (up arrow for raises_risk, down arrow for lowers_risk, dash for neutral)
    - Apply color based on direction (red for raises_risk, green for lowers_risk, gray for neutral)
    - _Requirements: 3.5, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 7.6 Create ShapDriverList component
    - Accept props: drivers (ShapDriver[]), maxDrivers (default 5)
    - Sort drivers by absolute impact (descending order)
    - Render top N drivers using ShapDriverItem component
    - Add tooltip explaining what SHAP values represent
    - Display "Top Risk Factors" heading
    - _Requirements: 3.5, 4.1, 4.6_
  
  - [ ]* 7.7 Write unit tests for ShapDriverList
    - Test drivers are sorted by absolute impact
    - Test only top N drivers are displayed
    - Test raises_risk drivers show red styling
    - Test lowers_risk drivers show green styling
    - Test neutral drivers show gray styling
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 7.8 Create ResultsDisplay component
    - Accept props: prediction (PredictionResponse), onNewAssessment callback
    - Render PredictionBadge with prediction value
    - Render RiskBandIndicator with risk_band value
    - Display ckd_score as percentage with one decimal place
    - Render ImputationWarning if imputation_count > 0
    - Render ShapDriverList with shap_drivers array
    - Display model disclaimer text from API response
    - Add "New Assessment" button that calls onNewAssessment prop
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [ ]* 7.9 Write integration tests for results display
    - Test complete results rendering with mocked prediction response
    - Test "New Assessment" button calls onNewAssessment callback
    - Test imputation warning appears when imputation_count > 0
    - Test SHAP drivers are displayed correctly
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

- [ ] 8. Implement health monitoring and API status
  - [ ] 8.1 Create HealthMonitor component
    - Accept props: onStatusChange callback, checkInterval (default 60000ms)
    - Initialize health check on component mount
    - Call API_Client.checkHealth() to get health response
    - Update status state based on response (ok, degraded, offline)
    - Set up recurring health checks using setInterval
    - Call onStatusChange prop when status changes
    - Clean up interval on component unmount
    - _Requirements: 5.1, 5.5_
  
  - [ ] 8.2 Create StatusBanner component
    - Accept props: status ('checking' | 'ok' | 'degraded' | 'offline')
    - Render banner for degraded status with yellow warning styling
    - Render banner for offline status with red error styling
    - Hide banner when status is 'ok'
    - Display appropriate message for each status
    - Add retry button for offline status
    - _Requirements: 5.2, 5.3, 5.4_
  
  - [ ] 8.3 Integrate health monitoring into App component
    - Add HealthMonitor component to App root
    - Store API status in App state
    - Disable AssessmentForm when status is not 'ok'
    - Display StatusBanner with current status
    - Load model metadata from /model endpoint when status is 'ok'
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  
  - [ ]* 8.4 Write integration tests for health monitoring
    - Test health check on app load calls /health endpoint
    - Test status 'ok' enables assessment form
    - Test status 'degraded' displays warning banner and disables form
    - Test status 'offline' displays error banner
    - Mock health endpoint responses with MSW
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 9. Build batch assessment upload feature
  - [ ] 9.1 Create BatchUpload component structure
    - Set up component state for file, uploading, progress, results, errors
    - Create file input with accept=".csv" attribute
    - Add drag-and-drop zone for CSV files
    - Implement handleFileSelect function to validate file
    - _Requirements: 8.1, 8.2_
  
  - [ ] 9.2 Implement CSV file validation
    - Check file extension is .csv
    - Check file size is under 10MB
    - Parse CSV headers and validate against expected columns
    - Display validation errors if file is invalid
    - _Requirements: 8.1, 8.7_
  
  - [ ] 9.3 Implement batch upload submission
    - Read CSV file content as text
    - Call API_Client.predictBatch() with CSV content
    - Show progress indicator during upload
    - Update uploading state and progress percentage
    - Handle upload completion and store results
    - Handle API errors and display error messages with row numbers
    - _Requirements: 8.2, 8.3, 8.6, 8.7, 9.6_
  
  - [ ] 9.4 Create BatchResultsTable component
    - Accept props: results (BatchPredictionResponse)
    - Display summary showing total count
    - Render table with columns: row number, prediction, ckd_score, risk_band, imputation_count
    - Apply color coding to risk_band cells
    - Add sorting functionality to table columns
    - Implement pagination for large result sets (>50 rows)
    - _Requirements: 8.4, 8.5_
  
  - [ ] 9.5 Implement batch results export
    - Add "Export Results" button to BatchResultsTable
    - Generate CSV file with original data plus prediction columns
    - Append columns: prediction, ckd_score, risk_band, imputation_count
    - Trigger browser download with appropriate filename
    - _Requirements: 8.6_
  
  - [ ]* 9.6 Write integration tests for batch upload
    - Test valid CSV file uploads successfully
    - Test invalid file extension shows error
    - Test batch results table displays all results
    - Test export functionality generates CSV file
    - Mock batch prediction endpoint with MSW
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7_

- [ ] 10. Checkpoint - Ensure batch upload works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement navigation and layout
  - [ ] 11.1 Create Header component
    - Display application title "CKD Risk Assessment"
    - Add logo or branding if available
    - Show model metadata when available (name, version)
    - Apply responsive styling for mobile and desktop
    - _Requirements: 10.2_
  
  - [ ] 11.2 Create NavigationTabs component
    - Create tabs for "Single Assessment" and "Batch Upload"
    - Implement active tab state management
    - Apply active styling to selected tab
    - Add keyboard navigation support (arrow keys)
    - _Requirements: 8.1_
  
  - [ ] 11.3 Create MainLayout component
    - Render Header at top
    - Render NavigationTabs below header
    - Render AssessmentForm or BatchUpload based on active tab
    - Render ResultsDisplay when results are available
    - Apply responsive container with max-width
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 11.4 Create Footer component
    - Display model metadata (accuracy, recall, precision, training date)
    - Show feature count used by model
    - Add link to view full model card if available
    - Display last updated timestamp
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 12. Implement loading states and user feedback
  - [ ] 12.1 Create LoadingSpinner component
    - Accept props: message (optional), size ('small' | 'medium' | 'large')
    - Render animated spinner with appropriate size
    - Display message below spinner if provided
    - Style for accessibility (ARIA live region)
    - _Requirements: 9.1, 9.3, 9.4_
  
  - [ ] 12.2 Integrate loading states into AssessmentForm
    - Show LoadingSpinner on submit button during submission
    - Display "Analyzing patient data..." message during request
    - Disable all form inputs while loading
    - Hide spinner and show results on success
    - Hide spinner and show error on failure
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 12.3 Add visual feedback for button clicks
    - Apply color change or animation on submit button click
    - Add ripple effect or scale animation on click
    - Ensure feedback is visible before loading state
    - _Requirements: 9.7_

- [ ] 13. Implement App component and state management
  - [ ] 13.1 Create App component with global state
    - Set up state for apiStatus, modelMetadata, currentView
    - Implement initializeApp function to check health and load metadata
    - Implement handleViewChange function to switch between single and batch modes
    - Call initializeApp on component mount
    - _Requirements: 5.1, 10.1_
  
  - [ ] 13.2 Wire components together in App
    - Render HealthMonitor with onStatusChange callback
    - Render MainLayout with AssessmentForm and BatchUpload based on currentView
    - Pass apiStatus to components that need it
    - Pass modelMetadata to Header and Footer
    - Implement onNewAssessment callback to reset form and results
    - _Requirements: 5.1, 5.2, 8.1_
  
  - [ ] 13.3 Add error boundary for application errors
    - Create ErrorBoundary component with componentDidCatch lifecycle
    - Wrap App component with ErrorBoundary
    - Display fallback UI when errors are caught
    - Add "Reload" button to reset error state
    - Log errors to console in development
    - _Requirements: 9.5_

- [ ] 14. Implement accessibility features
  - [ ] 14.1 Add ARIA labels to all interactive elements
    - Add aria-label to all form inputs
    - Add aria-describedby to inputs with error messages
    - Add aria-live regions for dynamic content updates
    - Add role attributes to custom components (e.g., role="alert" for errors)
    - _Requirements: 7.7_
  
  - [ ] 14.2 Implement keyboard navigation
    - Ensure all interactive elements are focusable with Tab key
    - Add Enter key support for form submission
    - Add Escape key to clear form or close modals
    - Ensure logical tab order through form fields
    - Add skip navigation link for screen readers
    - _Requirements: 7.6_
  
  - [ ] 14.3 Ensure color contrast compliance
    - Verify all text meets 4.5:1 contrast ratio for normal text
    - Verify large text meets 3:1 contrast ratio
    - Test with browser contrast checkers
    - Apply WCAG 2.1 AA compliant color palette
    - _Requirements: 7.5_
  
  - [ ]* 14.4 Write accessibility tests
    - Test with jest-axe for automated WCAG violations
    - Test keyboard navigation through entire form
    - Test screen reader announcements with ARIA
    - Test focus management after form submission
    - _Requirements: 7.5, 7.6, 7.7_

- [ ] 15. Style components and implement responsive design
  - [ ] 15.1 Set up global styles and CSS variables
    - Create globals.css with CSS reset and base styles
    - Define CSS variables for colors, spacing, typography
    - Set minimum font size to 14px for body text
    - Configure responsive breakpoints (768px, 1024px, 1440px)
    - _Requirements: 7.4, 7.5_
  
  - [ ] 15.2 Implement responsive grid layouts
    - Use single-column layout for screens < 768px
    - Use two-column grid for form sections on screens > 1024px
    - Use three-column grid for form sections on screens > 1440px
    - Apply responsive padding and margins
    - Test layouts at all breakpoint sizes
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 15.3 Style form components
    - Style NumericInput with borders, focus states, error states
    - Style CategoricalSelect with dropdown styling
    - Style validation error messages (red text, icon)
    - Apply consistent spacing between form fields
    - Add hover states and transitions
    - _Requirements: 6.2, 6.4, 6.5_
  
  - [ ] 15.4 Style results display components
    - Style PredictionBadge with large text and distinct colors
    - Style RiskBandIndicator with color-coded bars
    - Style ShapDriverList with horizontal bar charts
    - Style ImputationWarning with yellow/orange background
    - Apply card-based layout for results section
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [ ] 16. Add model metadata display
  - [ ] 16.1 Implement getModelMetadata in API client
    - Call GET /model endpoint on app initialization
    - Parse ModelInfo response
    - Store in App state
    - Handle errors gracefully if endpoint unavailable
    - _Requirements: 10.1_
  
  - [ ] 16.2 Display metadata in Footer
    - Show model name and version
    - Display accuracy, recall, precision if available
    - Show training date with formatted date string
    - Display feature count
    - Add "View Model Card" link if provided by API
    - Update metadata when health check detects change
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 17. Implement form state persistence
  - [ ] 17.1 Save form data to sessionStorage
    - Serialize form state to JSON on field changes
    - Store in sessionStorage with key "ckd-form-state"
    - Debounce save operations to avoid excessive writes
    - _Requirements: 1.7, 9.5_
  
  - [ ] 17.2 Restore form data on page load
    - Check sessionStorage for saved form state on App mount
    - Parse JSON and populate form fields
    - Clear sessionStorage after successful submission
    - Handle invalid or corrupted saved state gracefully
    - _Requirements: 9.5_

- [ ] 18. Add validation service for clinical coherence checks
  - [ ] 18.1 Create ValidationService class
    - Implement validatePatientAge to warn for unusual ages (< 18 or > 100)
    - Implement validateClinicalCoherence to check for inconsistent combinations
    - Add check for high hemoglobin but anemia marked as yes
    - Add check for low blood pressure but hypertension marked as yes
    - Return warning messages (not errors) for coherence issues
    - _Requirements: 6.1, 6.7_
  
  - [ ] 18.2 Integrate coherence checks into AssessmentForm
    - Call ValidationService after schema validation passes
    - Display coherence warnings in a separate section
    - Allow user to proceed despite warnings
    - Add "I've reviewed the warnings" checkbox if warnings present
    - _Requirements: 6.2, 6.7_

- [ ] 19. Implement error logging and monitoring
  - [ ] 19.1 Create error logging utility
    - Log errors to console in development mode
    - Add structured logging with context (component, action, timestamp)
    - Include error stack traces
    - Add option to send errors to external monitoring service in production
    - _Requirements: 2.7, 9.5_
  
  - [ ] 19.2 Integrate error logging throughout app
    - Log API errors with request/response details
    - Log validation errors with field information
    - Log application errors caught by ErrorBoundary
    - Add user action logging for debugging (optional, privacy-aware)
    - _Requirements: 2.5, 2.7_

- [ ] 20. Final integration and end-to-end testing
  - [ ] 20.1 Test complete single assessment workflow
    - Start app and verify health check
    - Fill out form with valid patient data
    - Submit and verify prediction results display
    - Start new assessment and verify form resets
    - Test with all fields filled vs. some fields missing
    - _Requirements: 1.1, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_
  
  - [ ] 20.2 Test complete batch assessment workflow
    - Switch to batch upload tab
    - Upload valid CSV file
    - Verify batch results table displays
    - Export results and verify CSV download
    - Test with invalid CSV and verify error messages
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_
  
  - [ ] 20.3 Test error handling scenarios
    - Test with backend API offline (verify offline banner)
    - Test with backend returning 422 validation error
    - Test with backend returning 500 server error
    - Test with request timeout
    - Verify all error messages are user-friendly
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 5.3, 5.4_
  
  - [ ] 20.4 Test responsive behavior
    - Test at desktop resolution (1920x1080)
    - Test at laptop resolution (1366x768)
    - Test at tablet resolution (768x1024)
    - Verify layouts adapt appropriately
    - Test on mobile (375x667) for view-only
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 20.5 Test accessibility compliance
    - Run axe-core accessibility checker
    - Test keyboard navigation through entire app
    - Test with screen reader (NVDA or VoiceOver)
    - Verify color contrast meets WCAG 2.1 AA
    - Fix any violations found
    - _Requirements: 7.5, 7.6, 7.7_

- [ ] 21. Create documentation and deployment configuration
  - [ ] 21.1 Write README.md
    - Document project setup and installation
    - List all npm scripts (dev, build, test, preview)
    - Explain environment variables
    - Add architecture overview
    - Include screenshots of UI
    - Document browser compatibility requirements
    - _Requirements: All requirements_
  
  - [ ] 21.2 Create build configuration
    - Configure Vite production build settings
    - Set up code splitting for vendor and forms bundles
    - Configure source maps for debugging
    - Optimize bundle size (target < 500KB gzipped)
    - _Requirements: 2.1_
  
  - [ ] 21.3 Add deployment documentation
    - Document development server startup (npm run dev)
    - Document production build process (npm run build)
    - Add Docker configuration if needed
    - Document CORS configuration between frontend (port 5173) and backend (port 8000)
    - Add troubleshooting section
    - _Requirements: 2.1, 5.1_

- [ ] 22. Final checkpoint - Complete verification
  - Run all unit tests and ensure they pass
  - Run all integration tests and ensure they pass
  - Build production bundle and verify size
  - Test production build locally with npm run preview
  - Verify backend API remains unchanged and independent
  - Ask the user if questions arise or if they want to proceed with execution

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements from requirements.md for traceability
- The frontend is completely independent from the backend, enabling API reuse by other clients
- Property-based testing is not applicable for this UI-centric feature (see design document)
- Testing strategy uses unit tests, component tests, integration tests, and accessibility tests
- Development server runs on port 5173, backend API runs on port 8000
- All 24 clinical features support null values to handle missing patient data
- SHAP drivers provide explainability for model predictions
- Health monitoring ensures API availability before assessments
- Responsive design targets desktop and tablet, with mobile as view-only

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["4.1", "4.5"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["4.4"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2"] },
    { "id": 9, "tasks": ["5.3"] },
    { "id": 10, "tasks": ["5.4"] },
    { "id": 11, "tasks": ["5.5"] },
    { "id": 12, "tasks": ["7.1", "7.2", "7.4"] },
    { "id": 13, "tasks": ["7.3", "7.5"] },
    { "id": 14, "tasks": ["7.6"] },
    { "id": 15, "tasks": ["7.7"] },
    { "id": 16, "tasks": ["7.8"] },
    { "id": 17, "tasks": ["7.9"] },
    { "id": 18, "tasks": ["8.1", "8.2"] },
    { "id": 19, "tasks": ["8.3"] },
    { "id": 20, "tasks": ["8.4"] },
    { "id": 21, "tasks": ["9.1"] },
    { "id": 22, "tasks": ["9.2"] },
    { "id": 23, "tasks": ["9.3"] },
    { "id": 24, "tasks": ["9.4", "9.5"] },
    { "id": 25, "tasks": ["9.6"] },
    { "id": 26, "tasks": ["11.1", "11.2", "11.4", "12.1"] },
    { "id": 27, "tasks": ["11.3", "12.3", "16.1"] },
    { "id": 28, "tasks": ["12.2", "16.2"] },
    { "id": 29, "tasks": ["13.1"] },
    { "id": 30, "tasks": ["13.2"] },
    { "id": 31, "tasks": ["13.3"] },
    { "id": 32, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 33, "tasks": ["14.4"] },
    { "id": 34, "tasks": ["15.1"] },
    { "id": 35, "tasks": ["15.2", "15.3", "15.4"] },
    { "id": 36, "tasks": ["17.1"] },
    { "id": 37, "tasks": ["17.2"] },
    { "id": 38, "tasks": ["18.1"] },
    { "id": 39, "tasks": ["18.2"] },
    { "id": 40, "tasks": ["19.1"] },
    { "id": 41, "tasks": ["19.2"] },
    { "id": 42, "tasks": ["20.1", "20.2", "20.3", "20.4", "20.5"] },
    { "id": 43, "tasks": ["21.1", "21.2", "21.3"] }
  ]
}
```

# CKD Frontend

A React-based single-page application for chronic kidney disease (CKD) risk assessment.

## Overview

The CKD Frontend provides clinicians with a web interface to assess CKD risk by inputting patient clinical data. The application connects to the EthioCKD Clinical API (FastAPI backend) to submit patient data and display risk predictions with explainability information using SHAP values.

## Technology Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **State Management**: React hooks (useState, useReducer)
- **Form Management**: React Hook Form with Zod validation
- **Testing**: Vitest + React Testing Library + MSW (Mock Service Worker)
- **Code Quality**: ESLint + Prettier
- **HTTP Client**: Fetch API with custom wrapper

## Prerequisites

- Node.js 18+ and npm
- Backend API running on http://localhost:8000

## Getting Started

### Installation

```bash
npm install
```

### Development

Start the development server on port 5173:

```bash
npm run dev
```

The application will be available at http://localhost:5173

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Testing

### Run tests in watch mode

```bash
npm test
```

### Run tests once

```bash
npm run test:run
```

### Run tests with coverage

```bash
npm run test:coverage
```

## Code Quality

### Lint code

```bash
npm run lint
```

### Format code

```bash
npm run format
```

### Check formatting

```bash
npm run format:check
```

## Environment Variables

### Development (`.env.development`)

- `VITE_API_BASE_URL`: Backend API URL (default: http://localhost:8000)
- `VITE_API_TIMEOUT`: API request timeout in milliseconds (default: 30000)
- `VITE_HEALTH_CHECK_INTERVAL`: Health check interval in milliseconds (default: 60000)

### Production (`.env.production`)

- `VITE_API_BASE_URL`: Backend API URL (configure for production)
- `VITE_API_TIMEOUT`: API request timeout in milliseconds (default: 30000)
- `VITE_HEALTH_CHECK_INTERVAL`: Health check interval in milliseconds (default: 120000)

## Project Structure

```
ckd-frontend/
├── src/
│   ├── components/
│   │   ├── common/        # Reusable UI components
│   │   ├── form/          # Form input components
│   │   ├── results/       # Results display components
│   │   ├── batch/         # Batch upload components
│   │   └── health/        # Health monitoring components
│   ├── services/          # API client and services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── hooks/             # Custom React hooks
│   ├── styles/            # Global styles and CSS
│   ├── App.tsx            # Root component
│   └── main.tsx           # Application entry point
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── setup.ts           # Test setup and configuration
├── public/                # Static assets
└── ...config files
```

## Features

### Single Patient Assessment

- Input clinical data for 24 features (demographics, lab values, medical history)
- Real-time validation with clinical ranges
- Submit to API for CKD risk prediction
- Display results with:
  - Binary prediction (CKD / Not CKD)
  - Risk band (LOW / MODERATE / HIGH)
  - Confidence score
  - SHAP explanations showing which factors influenced the prediction
  - Imputation warnings for missing data

### Batch Assessment

- Upload CSV file with multiple patient records
- Process batch predictions
- View results table with all predictions
- Export enhanced CSV with prediction results

### Health Monitoring

- Automatic API health checks
- Status indicators (OK / Degraded / Offline)
- Disable form when API is unavailable
- Display model metadata

## API Integration

The frontend communicates with the FastAPI backend on port 8000:

- `GET /health` - Check API health status
- `GET /model` - Get model metadata
- `POST /predict` - Submit single patient assessment
- `POST /predict/batch` - Submit batch assessments

CORS is pre-configured on the backend to allow requests from port 5173.

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Accessibility

The application follows WCAG 2.1 AA guidelines:

- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast (4.5:1 for normal text)
- ARIA labels on all interactive elements
- Semantic HTML structure

## License

[Your License Here]

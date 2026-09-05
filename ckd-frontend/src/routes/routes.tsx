import type { RouteObject } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import AboutRoute from './AboutRoute';
import AssessmentRoute from './AssessmentRoute';
import DashboardRoute from './DashboardRoute';
import ExplainabilityRoute from './ExplainabilityRoute';
import FacilitiesRoute from './FacilitiesRoute';
import FederatedRoute from './FederatedRoute';
import LearnRoute from './LearnRoute';
import ModelCardRoute from './ModelCardRoute';
import MultimodalRoute from './MultimodalRoute';
import NotFoundRoute from './NotFoundRoute';
import ReportRoute from './ReportRoute';
import ResearchBatchRoute from './ResearchBatchRoute';
import ResearchRoute from './ResearchRoute';
import ResultsRoute from './ResultsRoute';
import RouteErrorPage from './RouteErrorPage';

/**
 * The route table.
 *
 * Exported as data rather than as a built router so tests can mount the same tree in
 * a `MemoryRouter` — a route that exists only inside `createBrowserRouter` cannot be
 * asserted on, and the point of the coverage test is that every advertised path
 * resolves to a real page.
 *
 * Flat under one layout (ADR-2), with a single exception: `/research/batch` nests, so
 * the URL states that batch scoring belongs to the research area rather than to the
 * screening path.
 *
 * `errorElement` is repeated on the children on purpose. On the root it would catch
 * everything, but it would also replace the header and navigation — leaving a user
 * whose page crashed with no way out except the browser's back button.
 *
 * Routes are loaded eagerly. Every page here is a shell; code-splitting begins in
 * Phase 3, when the chart and form libraries make a route heavy enough to be worth
 * deferring.
 */
export const ROUTES: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardRoute />, errorElement: <RouteErrorPage /> },
      { path: 'assessment', element: <AssessmentRoute />, errorElement: <RouteErrorPage /> },
      { path: 'results', element: <ResultsRoute />, errorElement: <RouteErrorPage /> },
      { path: 'explainability', element: <ExplainabilityRoute />, errorElement: <RouteErrorPage /> },
      { path: 'report', element: <ReportRoute />, errorElement: <RouteErrorPage /> },
      { path: 'learn', element: <LearnRoute />, errorElement: <RouteErrorPage /> },
      { path: 'multimodal', element: <MultimodalRoute />, errorElement: <RouteErrorPage /> },
      { path: 'federated', element: <FederatedRoute />, errorElement: <RouteErrorPage /> },
      {
        path: 'research',
        element: <ResearchRoute />,
        errorElement: <RouteErrorPage />,
        children: [{ path: 'batch', element: <ResearchBatchRoute /> }],
      },
      { path: 'model-card', element: <ModelCardRoute />, errorElement: <RouteErrorPage /> },
      { path: 'about', element: <AboutRoute />, errorElement: <RouteErrorPage /> },
      { path: 'facilities', element: <FacilitiesRoute />, errorElement: <RouteErrorPage /> },
      { path: '*', element: <NotFoundRoute /> },
    ],
  },
];

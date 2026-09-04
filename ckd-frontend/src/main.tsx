import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import './styles/app.css';
import { AppProviders } from './AppProviders';
import { ROUTES } from './routes/routes';

/**
 * Application entry point.
 *
 * `createBrowserRouter` needs the deployment to serve `index.html` for any unmatched
 * path — the same reverse proxy that maps `/api/*` to the backend. A static host
 * without that rewrite will 404 on a refresh of `/results`, which is a hosting
 * configuration rather than a code problem, but it fails silently in exactly the
 * place users notice.
 *
 * `StrictMode` stays on. It double-invokes effects in development, which is how the
 * timer leak in the tooltip and the storage reads in the draft helper were caught —
 * turning it off to quieten a warning would give up the only free correctness check
 * React offers.
 */
const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element #root is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={createBrowserRouter(ROUTES)} />
    </AppProviders>
  </StrictMode>
);

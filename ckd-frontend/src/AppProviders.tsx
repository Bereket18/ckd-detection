import { useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { createQueryClient } from './lib/query/client';
import { PredictionProvider } from './lib/state/PredictionProvider';

interface AppProvidersProps {
  children: ReactNode;
  /** Test seam: pass a per-test client so caches cannot leak between tests. */
  queryClient?: QueryClient;
}

/**
 * Everything that must sit above the router, in the order it must sit in.
 *
 * The nesting is not arbitrary:
 *
 * 1. `ErrorBoundary` outermost, so a crash inside a provider is still caught. A
 *    boundary below the providers cannot catch the thing most likely to take the
 *    whole application down.
 * 2. `QueryClientProvider` next, holding the three server reads.
 * 3. `PredictionProvider` innermost but still above the router, which is what makes
 *    the prediction survive navigation between Assessment, Results, and
 *    Explainability while disappearing on reload (ADR-13).
 *
 * The client is created inside `useState` rather than at module scope so each mount —
 * and therefore each test — gets its own cache.
 */
export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <PredictionProvider>{children}</PredictionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

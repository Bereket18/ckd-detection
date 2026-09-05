import { Component, type ErrorInfo, type ReactNode } from 'react';
import { devLogFailure } from '../../lib/log';
import { Button } from '../ui/Button';
import { Container } from '../ui/Container';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of the default page when a render throws. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * The last line of defence: a render crash anywhere below this point.
 *
 * A class component because React offers no hook equivalent — `componentDidCatch`
 * has no functional counterpart, and that is unlikely to change.
 *
 * Two details are deliberate. Only a boolean is kept in state, never the error
 * object: a React error message can quote props, and props on this application can
 * contain a patient's answers, so storing it invites it onto the screen later. And
 * recovery is a full reload rather than a state reset — a component tree that threw
 * mid-render is in an unknown state, and "try again" that silently re-throws is
 * worse than an honest restart. The reload also clears any prediction from memory,
 * which is the correct outcome for a crash on a medical result.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Name only — never the message, the stack, or the component props. The
    // component name comes from React's own stack and contains no user data.
    void info;
    devLogFailure('render boundary', error.name);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <Container width="prose" className="py-16">
        <div role="alert" className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Something went wrong on this page
          </h1>
          <p className="text-ink-muted">
            The page stopped working before it finished loading. Nothing you entered has been sent
            anywhere, and no result is being shown — reloading will start again from a clean state.
          </p>
          <Button onClick={() => window.location.reload()}>Reload the page</Button>
        </div>
      </Container>
    );
  }
}

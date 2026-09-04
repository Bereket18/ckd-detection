import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from './Alert';
import { Badge } from './Badge';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { Skeleton, SkeletonText } from './Skeleton';
import { Spinner } from './Spinner';
import {
  APIError,
  NetworkError,
  TimeoutError,
  contractError,
  normalizeError,
} from '../../lib/api';

/**
 * Component-tier tests for the feedback primitives.
 *
 * The recurring question in this file is *how loudly* something is announced. A
 * failure that interrupts a screen reader mid-sentence and a background poll that
 * does the same are the same code with different consequences, so politeness is
 * asserted explicitly rather than left to whichever role happened to be typed.
 */

describe('Alert', () => {
  it('announces an error assertively, because it blocks the task', () => {
    render(
      <Alert tone="danger" title="Could not submit">
        Try again.
      </Alert>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent('Could not submit');
  });

  it.each(['info', 'warn', 'success', 'neutral'] as const)(
    'announces %s politely, because it does not',
    (tone) => {
      render(<Alert tone={tone}>Background change.</Alert>);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    }
  );

  it('lets a caller silence the live region for something already announced', () => {
    render(
      <Alert tone="warn" live="off">
        Duplicate of the banner above.
      </Alert>
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'off');
  });

  it('keeps actions out of the message so neither is clipped', async () => {
    const onRetry = vi.fn();
    render(
      <Alert tone="warn" actions={<button type="button" onClick={onRetry}>Retry</button>}>
        The check did not complete.
      </Alert>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Badge', () => {
  it('renders its own text, so it is never colour alone', () => {
    render(<Badge tone="warn">MODERATE</Badge>);
    expect(screen.getByText('MODERATE')).toBeVisible();
  });
});

describe('Spinner', () => {
  it('says nothing when the surrounding component already did', () => {
    const { container } = render(<Spinner />);
    // Two announcements for one event is worse than none, so a bare spinner is
    // decoration and is hidden from the accessibility tree.
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('announces itself when it is the only thing saying so', () => {
    render(<Spinner label="Checking the service" />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking the service');
  });

  it('stops animating under prefers-reduced-motion', () => {
    const { container } = render(<Spinner />);
    // Asserted on the class because jsdom applies no stylesheet: the guarantee is
    // that the escape hatch is requested, and the media query is in app.css.
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'motion-reduce:animate-none'
    );
  });
});

describe('Skeleton', () => {
  it('is invisible to assistive technology', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    // A screen reader reading five grey rectangles is worse than silence; the
    // announcement belongs to LoadingState's live region.
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the requested number of lines and ragged-ends the last one', () => {
    const { container } = render(<SkeletonText lines={4} />);
    const lines = container.firstElementChild?.children ?? [];
    expect(lines).toHaveLength(4);
    // Real prose rarely fills its last line; an even block reads as a table.
    expect(lines[3]?.getAttribute('class')).toContain('w-3/5');
  });

  it('cannot be asked for zero lines', () => {
    const { container } = render(<SkeletonText lines={0} />);
    expect(container.firstElementChild?.children).toHaveLength(1);
  });
});

describe('LoadingState', () => {
  it('is one polite, busy live region', () => {
    render(
      <LoadingState label="Loading model information">
        <SkeletonText lines={2} />
      </LoadingState>
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    // aria-busy tells a batching AT the region is mid-change rather than empty;
    // neither attribute implies the other.
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Loading model information');
  });

  it('can keep the announcement while hiding the visible label', () => {
    render(<LoadingState label="Loading model information" quiet />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading model information');
  });
});

describe('EmptyState', () => {
  it('is not announced, because absence is not an event', () => {
    render(
      <EmptyState
        title="No result to show yet"
        description="Complete an assessment and the result will appear here."
        action={<button type="button">Start an assessment</button>}
      />
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('No result to show yet')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start an assessment' })).toBeVisible();
  });
});

/**
 * `ErrorState` renders a `NormalizedError` and nothing else.
 *
 * The errors below are built by `normalizeError` from what the client actually
 * throws, rather than hand-written objects: a test that invents its own error shape
 * cannot notice that the real pipeline stopped producing that shape.
 */
describe('ErrorState', () => {
  it('shows the normalized wording, never the raw APIError message', () => {
    const error = normalizeError(new APIError(503, 'Service Unavailable', { detail: 'model missing' }));
    render(<ErrorState error={error} />);

    expect(screen.getByText('The service is temporarily unavailable')).toBeVisible();
    // Phase 0's layering: APIError.message stays raw and is never displayed.
    expect(screen.queryByText('503 Service Unavailable')).toBeNull();
  });

  it('never renders the backend detail string', () => {
    // 415 and a degraded 503 send `detail` as a bare string that can embed an
    // absolute filesystem path. There is no prop that could carry it here.
    const detail = 'C:\\Users\\berek\\saved_models\\tabular_model.joblib not found';
    const error = normalizeError(new APIError(415, 'Unsupported Media Type', { detail }));
    const { container } = render(<ErrorState error={error} />);

    expect(container.textContent).not.toContain('saved_models');
    expect(container.textContent).not.toMatch(/[A-Za-z]:\\/);
    expect(screen.getByText('That file type is not accepted')).toBeVisible();
  });

  it('offers a retry only when the failure can be retried', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <ErrorState error={normalizeError(new TimeoutError('timeout'))} onRetry={onRetry} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // A 422 is not retryable: the same request would fail identically.
    rerender(
      <ErrorState
        error={normalizeError(
          new APIError(422, 'Unprocessable Entity', {
            detail: [{ loc: ['body', 'sc'], type: 'less_than_equal', ctx: { le: 76 } }],
          })
        )}
        onRetry={onRetry}
      />
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('interrupts for a blocking failure and waits for a background one', () => {
    const offline = normalizeError(new NetworkError('offline'));
    const { rerender } = render(<ErrorState error={offline} />);
    // `offline` is a warning tone, so it waits rather than interrupting.
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

    rerender(<ErrorState error={normalizeError(new APIError(500, 'Internal Server Error', {}))} />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('can be forced polite so a 60-second poll cannot keep interrupting', () => {
    render(<ErrorState assertive={false} error={normalizeError(new APIError(500, 'Server', {}))} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('explains a contract failure without showing a partial result', () => {
    render(<ErrorState error={contractError('risk_band: unrecognised value')} />);
    expect(screen.getByText('This result could not be displayed')).toBeVisible();
  });
});

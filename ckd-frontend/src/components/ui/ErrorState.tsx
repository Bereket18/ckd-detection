import type { ReactNode } from 'react';
import { CircleAlert, RotateCw, SearchX, ServerCrash, TriangleAlert, WifiOff } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { ErrorKind, NormalizedError } from '../../lib/api/errors';
import { Button } from './Button';
import { TONE_ICON, TONE_PANEL, type StatusTone } from './styles';

/**
 * One tone and one glyph per failure kind.
 *
 * The kinds are `NormalizedError['kind']` — imported rather than redeclared, so
 * adding a failure mode in `lib/api/errors` is a type error here until it has a
 * presentation. A component that silently fell back to "unknown" would hide the
 * omission.
 */
const KIND_TONE: Record<ErrorKind, StatusTone> = {
  validation: 'danger',
  'row-validation': 'danger',
  'unsupported-media': 'danger',
  unavailable: 'warn',
  server: 'danger',
  timeout: 'warn',
  offline: 'warn',
  'not-found': 'danger',
  contract: 'danger',
  unknown: 'danger',
};

function kindIcon(kind: ErrorKind, tone: StatusTone): ReactNode {
  const className = cn('size-6 shrink-0', TONE_ICON[tone]);
  switch (kind) {
    case 'offline':
      return <WifiOff aria-hidden className={className} />;
    case 'timeout':
      return <RotateCw aria-hidden className={className} />;
    case 'unavailable':
      return <ServerCrash aria-hidden className={className} />;
    case 'not-found':
      return <SearchX aria-hidden className={className} />;
    case 'server':
    case 'contract':
    case 'unknown':
      return <TriangleAlert aria-hidden className={className} />;
    default:
      return <CircleAlert aria-hidden className={className} />;
  }
}

interface ErrorStateProps {
  /** The normalized failure. Its `title` and `message` are the display copy. */
  error: NormalizedError;
  /**
   * Shown only when `error.retryable`. Omitting it on a retryable error is
   * allowed — some callers retry by navigating instead.
   */
  onRetry?: () => void;
  retryLabel?: string;
  /** Caller-supplied safe extras: a field list, a link to the model card. */
  children?: ReactNode;
  /**
   * Force the announcement politeness. Defaults to assertive for `danger` tones.
   * The polled health check passes `false` so it cannot interrupt a screen reader
   * every 60 seconds.
   */
  assertive?: boolean;
  className?: string;
}

/**
 * A failed operation, explained and recoverable.
 *
 * There is deliberately no slot for the backend's `detail` string. Two responses
 * the API actually emits — 415 and a degraded 503 — send `detail` as a bare string
 * that can embed absolute filesystem paths, and a component with a `detail` prop is
 * a component that will eventually be handed one. All user-facing wording comes from
 * `normalizeError`, which preserves the Phase 0 layering: `APIError.message` stays
 * raw and is never shown.
 */
export function ErrorState({
  error,
  onRetry,
  retryLabel = 'Try again',
  children,
  assertive,
  className,
}: ErrorStateProps) {
  const tone = KIND_TONE[error.kind];
  const isAssertive = assertive ?? tone === 'danger';

  return (
    <div
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      className={cn('flex gap-3 rounded-lg border p-4 sm:p-5', TONE_PANEL[tone], className)}
    >
      {kindIcon(error.kind, tone)}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <p className="font-semibold text-ink">{error.title}</p>
          <p className="text-sm text-ink-muted">{error.message}</p>
        </div>
        {children}
        {error.retryable && onRetry && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            icon={<RotateCw aria-hidden className="size-4" />}
          >
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TONE_ICON, TONE_PANEL, type StatusTone } from './styles';

export type AlertTone = Exclude<StatusTone, 'neutral'> | 'neutral';

interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children: ReactNode;
  /** Retry, dismiss, or a link. Sits below the message so it is never clipped. */
  actions?: ReactNode;
  /**
   * `assertive` interrupts the screen reader immediately; `polite` waits for a
   * pause. Validation summaries after a failed submit are assertive; a background
   * health change is polite. Defaults follow the tone.
   */
  live?: 'assertive' | 'polite' | 'off';
  className?: string;
}

const ICONS = {
  neutral: Info,
  info: Info,
  warn: TriangleAlert,
  danger: CircleAlert,
  success: CircleCheck,
} as const;

/**
 * An inline message about the thing next to it.
 *
 * The `role` is chosen from the tone rather than passed in, because the two must
 * agree: an error styled red but announced as a status is a silent failure for a
 * screen-reader user, and a polite success that hijacks focus is noise. `danger`
 * gets `role="alert"` (assertive by definition); everything else gets
 * `role="status"`.
 */
export function Alert({ tone = 'info', title, children, actions, live, className }: AlertProps) {
  const Icon = ICONS[tone];
  const isError = tone === 'danger';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={live ?? (isError ? 'assertive' : 'polite')}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', TONE_PANEL[tone], className)}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', TONE_ICON[tone])} />
      <div className="min-w-0 space-y-1.5">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div className="text-ink-muted">{children}</div>
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </div>
    </div>
  );
}

import { cn } from '../../lib/cn';

interface ProgressProps {
  value: number;
  max?: number;
  /** Accessible name — what is progressing. Required; a nameless bar is noise. */
  label: string;
  /**
   * Human phrasing of the position, e.g. "Step 2 of 6". Given to
   * `aria-valuetext` because "33" is a true but useless announcement, and shown
   * beside the bar unless `hideValueText`.
   */
  valueText?: string;
  hideValueText?: boolean;
  className?: string;
}

/**
 * A determinate progress bar.
 *
 * Built from divs with explicit ARIA rather than `<progress>`: the native element
 * cannot be styled consistently across engines and, more importantly, cannot carry
 * `aria-valuetext`, which is the only way to announce "Step 2 of 6" instead of a
 * bare percentage.
 *
 * There is no indeterminate mode on purpose — an indeterminate bar and a spinner
 * say the same thing, and `Spinner` already says it.
 */
export function Progress({
  value,
  max = 100,
  label,
  valueText,
  hideValueText = false,
  className,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div className={cn('space-y-1.5', className)}>
      {valueText !== undefined && !hideValueText && (
        <p className="text-sm font-medium text-ink-muted">{valueText}</p>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        {/*
          The fill is a plain block sized by inline style — the width is data, not a
          design decision, and there is no utility class for "43.7%". Transition
          duration comes from the motion token, so `prefers-reduced-motion` shortens
          it with everything else.
        */}
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) ease-(--ease-standard)"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

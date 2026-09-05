import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { FieldFrame } from './FieldFrame';
import { HIT_AREA_44, inputClasses } from './styles';

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'aria-invalid' | 'aria-describedby'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  tooltip?: ReactNode;
  /** Unit text shown inside the field, e.g. `mg/dL`. Decorative, not a value. */
  suffix?: ReactNode;
  /** When provided, renders a clear control that resets the field to "not provided". */
  onClear?: () => void;
  clearLabel?: string;
}

/**
 * A text or numeric input with its label, hint, and error state.
 *
 * `aria-invalid` is derived from `error` rather than passed separately, so the red
 * border and the state a screen reader announces cannot drift apart. The clear
 * control sits at `tabIndex={-1}`: tabbing should move between questions, not
 * pause on a per-field affordance, and it is still reachable by pointer and by a
 * screen reader's own navigation.
 */
export function Input({
  label,
  hint,
  error,
  optional = false,
  tooltip,
  suffix,
  onClear,
  clearLabel = 'Clear this answer',
  className,
  value,
  ...rest
}: InputProps) {
  const uid = useId();
  const inputId = `field-${uid}`;
  const hintId = `hint-${uid}`;
  const errorId = `error-${uid}`;

  // Error first: it is the thing that changed and the thing that blocks progress.
  // The hint follows because it usually contains the range that was violated.
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  const hasSuffix = suffix !== undefined && suffix !== null && suffix !== false;
  const showClear = onClear !== undefined && value !== '' && value !== undefined && value !== null;

  // Room reserved inside the field for whatever sits at its end. Sized to what is
  // actually there: the clear control presents a 44 px target, so it needs more
  // than the unit text does, and a field with neither needs none at all.
  const paddingEnd = hasSuffix && showClear ? 'pe-28' : hasSuffix ? 'pe-20' : showClear ? 'pe-14' : null;

  return (
    <FieldFrame
      inputId={inputId}
      label={label}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      optional={optional}
      tooltip={tooltip}
    >
      <div className="relative flex items-center">
        <input
          {...rest}
          id={inputId}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className={inputClasses(cn(paddingEnd, className))}
        />

        <span className="absolute end-2 flex items-center gap-1">
          {hasSuffix && (
            <span aria-hidden className="text-xs text-ink-subtle">
              {suffix}
            </span>
          )}
          {showClear && (
            <button
              type="button"
              tabIndex={-1}
              onClick={onClear}
              aria-label={clearLabel}
              title={clearLabel}
              className={cn(
                'inline-flex size-6 items-center justify-center rounded-full text-ink-subtle hover:bg-surface-sunken hover:text-ink',
                HIT_AREA_44
              )}
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </span>
      </div>
    </FieldFrame>
  );
}

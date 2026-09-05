import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { FieldFrame } from './FieldFrame';
import { selectClasses } from './styles';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    'id' | 'aria-invalid' | 'aria-describedby' | 'children'
  > {
  label: ReactNode;
  options: readonly SelectOption[];
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  tooltip?: ReactNode;
  /**
   * Text for the empty option. It represents *no answer*, which the API accepts
   * and imputes — so it is a real choice, not a prompt to be dismissed. Phrasing
   * it as "Not provided" rather than "Select…" is the difference between a user
   * knowing they may skip a question and guessing at one (R1.5).
   */
  emptyLabel?: string;
}

/**
 * A native `<select>` with its label, hint, and error state.
 *
 * Native on purpose (ADR-11): the platform control brings free keyboard support, a
 * usable touch picker, and correct behaviour with a screen reader, none of which a
 * hand-built listbox reliably matches. The only cosmetic change is hiding the
 * platform caret — its position and contrast vary per OS — and drawing one.
 */
export function Select({
  label,
  options,
  hint,
  error,
  optional = false,
  tooltip,
  emptyLabel = 'Not provided',
  className,
  ...rest
}: SelectProps) {
  const uid = useId();
  const selectId = `field-${uid}`;
  const hintId = `hint-${uid}`;
  const errorId = `error-${uid}`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <FieldFrame
      inputId={selectId}
      label={label}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
      optional={optional}
      tooltip={tooltip}
    >
      <div className="relative flex items-center">
        <select
          {...rest}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className={selectClasses(className)}
        >
          <option value="">{emptyLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className={cn('pointer-events-none absolute end-3 size-4 text-ink-subtle')}
        />
      </div>
    </FieldFrame>
  );
}

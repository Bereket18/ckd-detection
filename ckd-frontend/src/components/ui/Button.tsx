import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './styles';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** In-flight state: shows a spinner and blocks activation, but keeps focus. */
  loading?: boolean;
  /** Announced while `loading`. Say what is happening, not "Loading…". */
  loadingLabel?: string;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
}

/**
 * Button.
 *
 * Two deliberate details:
 *
 * - `type` defaults to `"button"`. The HTML default is `"submit"`, which turns
 *   every unlabelled button inside a form into an accidental submit — on an
 *   assessment form that means submitting a half-filled patient record.
 * - `loading` uses `aria-disabled` rather than the native `disabled`, and swallows
 *   the click. A natively disabled element leaves the tab order, so a keyboard
 *   user who just pressed Enter on *Submit* would find focus dumped back at the
 *   top of the document while the request is in flight. `disabled` proper still
 *   maps to the native attribute, because a permanently unavailable control has
 *   no reason to be focusable.
 */
export function Button({
  variant,
  size,
  loading = false,
  loadingLabel,
  icon,
  iconPosition = 'start',
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const glyph = loading ? (
    <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
  ) : (
    icon
  );

  return (
    <button
      {...rest}
      type={type}
      className={buttonClasses(variant, size, className)}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      {glyph && iconPosition === 'start' && glyph}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
      {glyph && iconPosition === 'end' && glyph}
    </button>
  );
}

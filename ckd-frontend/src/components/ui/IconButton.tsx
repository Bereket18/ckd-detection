import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { iconButtonClasses, type ButtonSize, type ButtonVariant } from './styles';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /**
   * Required, not optional. An icon-only button with no accessible name is
   * announced as "button" and is unusable, and it is the single most common
   * accessibility defect in a component library — so the type system asks for the
   * name rather than a linter complaining about it later.
   */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** A square, icon-only button. The label is its accessible name and its tooltip. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClasses(variant, size, className)}
    >
      {icon}
    </button>
  );
}

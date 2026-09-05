/**
 * The design system's class recipes, in one file.
 *
 * Kept out of the `.tsx` files for a mechanical reason: `eslint-plugin-react-refresh`
 * only allows component (and constant) exports from a file that exports a
 * component, and CI runs lint with `--max-warnings=0`. It turns out to be the
 * better arrangement anyway — the entire visual vocabulary is greppable here, so
 * "what does a secondary button look like" has exactly one answer, and a `<Link>`
 * that must look like a button can share the recipe instead of copying it.
 */

import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type StatusTone = 'neutral' | 'info' | 'warn' | 'danger' | 'success';

/** Focus comes from the global `:focus-visible` rule, so it is not repeated here. */
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md border font-medium ' +
  'transition-colors duration-(--duration-fast) ease-(--ease-standard) ' +
  'disabled:cursor-not-allowed disabled:opacity-55 aria-busy:cursor-progress';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-accent bg-accent text-white hover:bg-accent-hover active:bg-accent-active',
  secondary:
    'border-border-strong bg-surface text-ink hover:bg-surface-sunken active:bg-surface-sunken',
  ghost: 'border-transparent bg-transparent text-accent-ink hover:bg-accent-soft',
  danger: 'border-danger bg-danger text-white hover:brightness-110 active:brightness-95',
};

/**
 * Heights are touch targets, not decoration.
 *
 * All three sizes are ≥ 44 px, the minimum architecture §9.8 commits to for every
 * control including *I don't know* and the help trigger. `sm` was 40 px until the
 * target-size test was written, which is exactly the kind of near-miss that ships:
 * it looks deliberate, it reads as "small", and it fails the standard the document
 * claims to meet. So `sm` now means visually lighter — less padding, smaller type —
 * and never physically smaller than a fingertip.
 */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-base',
  lg: 'min-h-12 px-5 text-lg',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string
): string {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

/** Square, icon-only. Always needs an `aria-label` — the component enforces it. */
export function iconButtonClasses(
  variant: ButtonVariant = 'ghost',
  size: ButtonSize = 'md',
  className?: string
): string {
  // `sm` is 44 px square like `md`; it differs in the glyph it holds, not in how
  // large a target it presents. See BUTTON_SIZES.
  const box = size === 'lg' ? 'size-12' : 'size-11';
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], box, 'px-0', className);
}

/**
 * A 44 px hit area around a control that must stay visually small.
 *
 * Used by the two glyph controls that sit inline in text — the help trigger and the
 * clear-this-answer control. Growing the box to 44 px would push the line height of
 * every label it appears beside, so the target is expanded with a transparent
 * pseudo-element instead: 24 px of glyph plus 10 px on each side is 44 px of
 * touchable area and no change to layout.
 */
export const HIT_AREA_44 = "relative after:absolute after:-inset-2.5 after:content-['']";

/**
 * Surfaces.
 *
 * One elevation step, used to separate a panel from the page — not to decorate.
 * "Excessive cards" is the fastest way to make a clinical tool look like an admin
 * dashboard, so `Card` is for content that genuinely groups, and pages are
 * expected to use plain sections most of the time.
 */
export function cardClasses(className?: string): string {
  return cn('rounded-lg border border-border bg-surface shadow-card', className);
}

/**
 * Field shell. `aria-invalid` drives the error styling rather than a separate
 * prop, so the visual state and the state announced to a screen reader cannot
 * disagree (R6.4, R7.4).
 */
const CONTROL_BASE =
  'w-full min-h-11 rounded-md border border-border-strong bg-surface px-3 text-base text-ink ' +
  'placeholder:text-ink-subtle transition-colors duration-(--duration-fast) ' +
  'hover:border-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-sunken ' +
  'disabled:text-ink-subtle aria-invalid:border-danger aria-invalid:bg-danger-soft';

export function inputClasses(className?: string): string {
  return cn(CONTROL_BASE, className);
}

export function selectClasses(className?: string): string {
  // `appearance-none` plus a caret drawn by the component: the native caret sits
  // in a different place on every platform and cannot be given a contrast ratio.
  return cn(CONTROL_BASE, 'appearance-none pr-10', className);
}

/** Tone maps for the things that carry meaning: status chips, alerts, banners. */
export const TONE_CHIP: Record<StatusTone, string> = {
  neutral: 'border-border-strong bg-surface-sunken text-ink-muted',
  info: 'border-info/35 bg-info-soft text-info',
  warn: 'border-warn/35 bg-warn-soft text-warn',
  danger: 'border-danger/35 bg-danger-soft text-danger',
  success: 'border-success/35 bg-success-soft text-success',
};

export const TONE_PANEL: Record<StatusTone, string> = {
  neutral: 'border-border bg-surface-sunken text-ink',
  info: 'border-info/30 bg-info-soft text-ink',
  warn: 'border-warn/30 bg-warn-soft text-ink',
  danger: 'border-danger/30 bg-danger-soft text-ink',
  success: 'border-success/30 bg-success-soft text-ink',
};

/** The icon inside a panel keeps the tone colour; the body text stays `ink`. */
export const TONE_ICON: Record<StatusTone, string> = {
  neutral: 'text-ink-muted',
  info: 'text-info',
  warn: 'text-warn',
  danger: 'text-danger',
  success: 'text-success',
};

/**
 * Page width. `content` is the default; `prose` keeps educational copy near 70
 * characters a line; `form` keeps the assessment narrow enough to read as one
 * question at a time. Padding starts at 320 px and grows, never the reverse.
 */
export type ContainerWidth = 'prose' | 'form' | 'content' | 'wide';

export const CONTAINER_WIDTHS: Record<ContainerWidth, string> = {
  prose: 'max-w-(--container-prose)',
  form: 'max-w-(--container-form)',
  content: 'max-w-(--container-content)',
  wide: 'max-w-(--container-wide)',
};

export function containerClasses(width: ContainerWidth = 'content', className?: string): string {
  return cn('mx-auto w-full px-4 sm:px-6 lg:px-8', CONTAINER_WIDTHS[width], className);
}

/** Table foundation. Row striping is omitted on purpose: it competes with the
 * status chips that carry provenance, and zebra stripes fail at 320 px anyway
 * where the table becomes a scrolling region. */
export const TABLE_CLASSES = {
  scroller: 'w-full overflow-x-auto rounded-lg border border-border',
  table: 'w-full border-collapse text-left text-sm',
  caption: 'px-4 py-3 text-left text-sm text-ink-muted caption-bottom',
  th: 'border-b border-border bg-surface-sunken px-4 py-3 font-semibold text-ink whitespace-nowrap',
  td: 'border-b border-border px-4 py-3 align-top text-ink',
  numeric: 'text-right font-mono tabular-nums',
} as const;


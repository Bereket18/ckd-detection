import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * T-A11Y-05 (contrast) and T-A11Y-12 (the 14 px floor), computed from the token
 * file itself.
 *
 * Written with the tokens rather than after the components, for the reason the test
 * plan gives in §10: a failing ratio costs one hex digit to fix here and costs a
 * sweep of fifty components to fix later. It is a unit test over `app.css`, not a
 * screenshot — so it runs in milliseconds, has no browser dependency, and points at
 * the exact token rather than at a rendered pixel.
 *
 * The pairs below are the ones the product actually draws. A pair that no component
 * uses is not listed, because a passing assertion about an unused combination is
 * noise that makes the real coverage harder to read.
 */

const CSS = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8');

/** Every `--name: value;` declaration inside the `@theme` block. */
function readTokens(): Map<string, string> {
  const theme = /@theme\s*\{([\s\S]*?)\n\}/.exec(CSS);
  if (theme?.[1] === undefined) throw new Error('No @theme block found in app.css');

  const tokens = new Map<string, string>();
  for (const match of theme[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) tokens.set(name, value.trim());
  }
  return tokens;
}

const TOKENS = readTokens();

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const int = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(int)) throw new Error(`Not a hex colour: ${hex}`);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channels = hexToRgb(hex).map((raw) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

function token(name: string): string {
  const value = TOKENS.get(name);
  if (value === undefined) throw new Error(`Token ${name} is not declared in app.css`);
  return value;
}

/** Ratio rounded the way the WCAG tools report it, for readable failures. */
function ratio(foreground: string, background: string): number {
  return Math.round(contrast(token(foreground), token(background)) * 100) / 100;
}

/** The three surfaces any text can land on. */
const SURFACES = ['--color-paper', '--color-surface', '--color-surface-sunken'] as const;

/**
 * Body text: 4.5:1 (WCAG 1.4.3 AA). Everything in this list is small text somewhere
 * in the product, so none of it qualifies for the 3:1 large-text allowance.
 */
const BODY_PAIRS: readonly (readonly [string, string])[] = [
  ...SURFACES.flatMap(
    (surface) =>
      [
        ['--color-ink', surface],
        ['--color-ink-muted', surface],
        ['--color-ink-subtle', surface],
        ['--color-accent', surface],
        ['--color-accent-ink', surface],
        ['--color-info', surface],
        ['--color-warn', surface],
        ['--color-danger', surface],
        ['--color-success', surface],
      ] as const
  ),
];

/** Text on its own tinted panel — an Alert, a status chip, a risk-band panel. */
const SOFT_PAIRS: readonly (readonly [string, string])[] = [
  ['--color-accent-ink', '--color-accent-soft'],
  ['--color-info', '--color-info-soft'],
  ['--color-warn', '--color-warn-soft'],
  ['--color-danger', '--color-danger-soft'],
  ['--color-success', '--color-success-soft'],
  ['--color-band-low', '--color-band-low-soft'],
  ['--color-band-moderate', '--color-band-moderate-soft'],
  ['--color-band-high', '--color-band-high-soft'],
];

/** Text on a filled control or a risk-band chip. */
const INVERSE_PAIRS: readonly (readonly [string, string])[] = [
  ['--color-surface', '--color-accent'],
  ['--color-surface', '--color-accent-hover'],
  ['--color-surface', '--color-accent-active'],
  ['--color-surface', '--color-band-low'],
  ['--color-surface', '--color-band-moderate'],
  ['--color-surface', '--color-band-high'],
  ['--color-surface', '--color-danger'],
];

/**
 * Non-text: 3:1 (WCAG 1.4.11). Only boundaries that *identify* a control are
 * listed. `--color-border` is decorative separation — a divider between two blocks
 * of copy — and the standard does not require it to meet 3:1;
 * `--color-border-strong` draws an input's edge, so it does.
 */
const NON_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ...SURFACES.map((surface) => ['--color-border-strong', surface] as const),
  ...SURFACES.map((surface) => ['--color-focus', surface] as const),
];

describe('T-A11Y-05 · contrast meets AA', () => {
  it.each(BODY_PAIRS)('%s on %s is at least 4.5:1 for body text', (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SOFT_PAIRS)('%s on %s is at least 4.5:1 on a tinted panel', (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(INVERSE_PAIRS)('%s on %s is at least 4.5:1 reversed out', (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('%s on %s is at least 3:1 as a boundary', (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(3);
  });
});

/**
 * The floor is enforced at the token layer rather than by review: if no utility can
 * produce 12 px text, no component can ship 12 px text. `text-xs` is the smallest
 * name Tailwind offers, so redefining it is what closes the hole — a rule saying
 * "do not use `text-xs`" would be a convention, and conventions are not tested.
 */
describe('T-A11Y-12 · no text token resolves below 14 px', () => {
  const SIZE_TOKENS = [...TOKENS.entries()].filter(
    ([name]) => name.startsWith('--text-') && !name.includes('--line-height') && !name.includes('--letter-spacing')
  );

  it('finds the size tokens it is meant to be checking', () => {
    // A rename that broke the filter would otherwise leave this suite asserting
    // over an empty list and reporting success.
    expect(SIZE_TOKENS.length).toBeGreaterThanOrEqual(8);
  });

  it.each(SIZE_TOKENS)('%s (%s) is at least 14px', (_name, value) => {
    const rem = /^([\d.]+)rem$/.exec(value);
    expect(rem?.[1], `${value} is not expressed in rem`).toBeDefined();
    expect(Number(rem?.[1]) * 16).toBeGreaterThanOrEqual(14);
  });

  it('keeps 14px as the smallest step, so the floor is the default and not an edge case', () => {
    expect(token('--text-xs')).toBe('0.875rem');
  });
});

describe('token hygiene', () => {
  it('declares every colour as an opaque hex, so contrast is computable', () => {
    // A token in `rgb(... / 0.6)` cannot be checked without knowing what is behind
    // it, and "cannot be checked" is how a failing ratio ships. Translucency belongs
    // to shadows, which are decorative and declared separately.
    for (const [name, value] of TOKENS) {
      if (!name.startsWith('--color-')) continue;
      expect(value, `${name} is not an opaque hex colour`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('has no unreferenced colour token', () => {
    // An unused token is a decision nobody made. Every colour is either consumed by
    // a component (via a Tailwind utility) or listed in the pairs above.
    const declared = [...TOKENS.keys()].filter((name) => name.startsWith('--color-'));
    expect(declared.length).toBeGreaterThan(0);
    const covered = new Set(
      [...BODY_PAIRS, ...SOFT_PAIRS, ...INVERSE_PAIRS, ...NON_TEXT_PAIRS].flat()
    );
    // `--color-border` is the documented exception: decorative, so it appears in no
    // contrast pair, and it is asserted here so the exemption stays deliberate.
    covered.add('--color-border');
    expect(declared.filter((name) => !covered.has(name))).toEqual([]);
  });
});

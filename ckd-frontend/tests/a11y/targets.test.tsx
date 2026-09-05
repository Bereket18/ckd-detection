import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../../src/components/ui/Button';
import { IconButton } from '../../src/components/ui/IconButton';
import { Input } from '../../src/components/ui/Input';
import { Select } from '../../src/components/ui/Select';
import { Tooltip } from '../../src/components/ui/Tooltip';

/**
 * T-A11Y-11 · target size (architecture §9.8: ≥ 44 × 44 px, every control).
 *
 * **What this test is, and what it is not.** jsdom has no layout engine:
 * `getBoundingClientRect` returns zeros and the Vitest config disables CSS
 * processing, so no assertion here measures a rendered pixel. What it does instead
 * is assert the *recipe* — that every interactive primitive carries a size class
 * from the ≥ 44 px set, or the documented `HIT_AREA_44` expansion for the two
 * controls that must stay visually small.
 *
 * That is a weaker guarantee than a measurement and a real one: the way target size
 * regresses in practice is someone typing `min-h-9` because it looked better on a
 * desktop, and this fails on that. The measured check belongs to the browser pass in
 * `FRONTEND_ACCESSIBILITY_CHECKLIST.md`, which says so explicitly.
 *
 * Writing it is what surfaced two controls at 40 px and two at 24 px — all four in
 * code whose own comment claimed 44 px.
 */

/** Tailwind's 4 px scale: 11 → 44 px, 12 → 48 px. Nothing below 11 qualifies. */
const BIG_ENOUGH = /\b(?:min-h-(?:11|12|14|16)|size-(?:11|12|14|16)|h-(?:11|12|14|16))\b/;

/** The documented exemption: a 24 px glyph with a 44 px transparent hit area. */
const HIT_AREA = /after:-inset-2\.5/;

function assertTargetSize(element: Element, name: string): void {
  const classes = element.className;
  const ok = BIG_ENOUGH.test(classes) || HIT_AREA.test(classes);
  expect(ok, `${name} has no ≥44px size class and no hit-area expansion: ${classes}`).toBe(true);
}

describe('T-A11Y-11 · every control presents a 44px target', () => {
  it.each(['sm', 'md', 'lg'] as const)('a %s button does', (size) => {
    render(<Button size={size}>Continue</Button>);
    assertTargetSize(screen.getByRole('button', { name: 'Continue' }), `Button size=${size}`);
  });

  it.each(['sm', 'md', 'lg'] as const)('a %s icon button does', (size) => {
    render(<IconButton label="Close" size={size} icon={<svg aria-hidden />} />);
    assertTargetSize(screen.getByRole('button', { name: 'Close' }), `IconButton size=${size}`);
  });

  it('a text input does', () => {
    render(<Input label="Age" />);
    assertTargetSize(screen.getByLabelText(/age/i), 'Input');
  });

  it('a select does', () => {
    render(
      <Select label="Red blood cells" options={[{ value: 'normal', label: 'Normal' }]} />
    );
    assertTargetSize(screen.getByLabelText(/red blood cells/i), 'Select');
  });

  it('the help trigger does, through its hit-area expansion', () => {
    render(
      <Tooltip label="What is SHAP?" delayMs={0}>
        Help text.
      </Tooltip>
    );
    const trigger = screen.getByRole('button', { name: 'What is SHAP?' });
    // The glyph stays 24 px so it does not inflate the label line it sits in; the
    // target is 44 px. Both halves are asserted, because keeping only the first
    // would silently re-introduce the defect.
    expect(trigger.className).toMatch(/\bsize-6\b/);
    expect(trigger.className).toMatch(HIT_AREA);
  });

  it('the clear-this-answer control does', () => {
    render(<Input label="Age" value={45} onChange={() => {}} onClear={() => {}} />);
    const clear = screen.getByRole('button', { name: /clear this answer/i });
    assertTargetSize(clear, 'Input clear control');
  });

  it('leaves room inside the field for a 44px control and a unit', () => {
    // A 44 px target overlapping the value the user is typing is not a target, it is
    // a trap. The reserved padding grows with what is actually in the field.
    const { rerender } = render(<Input label="Age" value={45} onChange={() => {}} />);
    expect(screen.getByLabelText(/age/i).className).not.toMatch(/\bpe-/);

    rerender(<Input label="Age" value={45} onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByLabelText(/age/i).className).toMatch(/\bpe-14\b/);

    rerender(<Input label="Age" value={45} onChange={() => {}} suffix="years" />);
    expect(screen.getByLabelText(/age/i).className).toMatch(/\bpe-20\b/);

    rerender(
      <Input label="Age" value={45} onChange={() => {}} suffix="years" onClear={() => {}} />
    );
    expect(screen.getByLabelText(/age/i).className).toMatch(/\bpe-28\b/);
  });
});

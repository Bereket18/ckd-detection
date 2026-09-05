import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { Select } from './Select';
import { Progress } from './Progress';

/**
 * Component-tier tests for the interactive primitives.
 *
 * Every assertion here is about a guarantee the rest of the application is allowed
 * to assume — an accessible name, a state that cannot drift from its styling, a
 * click that cannot fire twice. Appearance is not tested; jsdom performs no layout,
 * and the visual review happens in a browser.
 */

describe('Button', () => {
  it('defaults to type="button" so it cannot submit a form by accident', () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('type', 'button');
  });

  it('submits only when asked to', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit');
  });

  it('stays focusable while loading and refuses the click', async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Scoring…" onClick={onClick}>
        Get result
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Scoring…' });
    // aria-disabled, not disabled: a natively disabled button leaves the tab order,
    // which would dump a keyboard user back to the top of the document mid-request.
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).not.toBeDisabled();

    button.focus();
    expect(button).toHaveFocus();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses the native disabled attribute when it is permanently unavailable', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Unavailable
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Unavailable' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the label as the accessible name when an icon is present', () => {
    render(<Button icon={<svg aria-hidden />}>Start assessment</Button>);
    // The icon must not become part of the name, or the name changes when the
    // decoration does.
    expect(screen.getByRole('button', { name: 'Start assessment' })).toBeVisible();
  });
});

describe('IconButton', () => {
  it('carries a name even though it shows only a glyph', () => {
    render(<IconButton label="Open menu" icon={<svg aria-hidden />} />);
    const button = screen.getByRole('button', { name: 'Open menu' });
    // Both channels: the accessible name and the pointer-hover tooltip.
    expect(button).toHaveAttribute('title', 'Open menu');
  });
});

describe('Input', () => {
  it('associates its label with the control', () => {
    render(<Input label="Serum creatinine" />);
    expect(screen.getByLabelText('Serum creatinine')).toBeInstanceOf(HTMLInputElement);
  });

  it('claims validity until it is told otherwise', () => {
    render(<Input label="Age" hint="Years, 2 to 90" />);
    const field = screen.getByLabelText('Age');
    // aria-invalid must be absent, not "false": a field the user has not filled in
    // is not an invalid field.
    expect(field).not.toHaveAttribute('aria-invalid');
    expect(field).toHaveAccessibleDescription('Years, 2 to 90');
  });

  it('marks invalidity once and describes it with the error before the hint', () => {
    render(<Input label="Age" hint="Years, 2 to 90" error="Enter a value between 2 and 90." />);
    const field = screen.getByLabelText('Age');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    // Order is load-bearing: the complaint is announced first, then the range it
    // was measured against.
    expect(field).toHaveAccessibleDescription('Enter a value between 2 and 90. Years, 2 to 90');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value between 2 and 90.');
  });

  it('renders the unit as decoration, never as a value', () => {
    render(<Input label="Blood urea" suffix="mg/dL" value="42" onChange={() => {}} />);
    expect(screen.getByLabelText('Blood urea')).toHaveValue('42');
    expect(screen.getByText('mg/dL')).toHaveAttribute('aria-hidden', 'true');
  });

  it('offers a clear control only once there is something to clear', async () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <Input label="Blood urea" value="" onChange={() => {}} onClear={onClear} />
    );
    expect(screen.queryByRole('button', { name: 'Clear this answer' })).toBeNull();

    rerender(<Input label="Blood urea" value="42" onChange={() => {}} onClear={onClear} />);
    const clear = screen.getByRole('button', { name: 'Clear this answer' });
    // Out of the tab order on purpose: tabbing moves between questions, and the
    // control stays reachable by pointer and by screen-reader navigation.
    expect(clear).toHaveAttribute('tabindex', '-1');

    await userEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not render a zero suffix as a stray digit', () => {
    render(<Input label="Age" suffix={0} />);
    expect(screen.getByText('0')).toBeVisible();
  });
});

describe('Select', () => {
  const OPTIONS = [
    { value: 'normal', label: 'Normal' },
    { value: 'abnormal', label: 'Abnormal' },
  ] as const;

  it('offers "not provided" as a real answer, first in the list', () => {
    render(<Select label="Red blood cells" options={OPTIONS} />);
    const select = screen.getByLabelText('Red blood cells');
    const options = screen.getAllByRole('option');

    // The API imputes a missing value and discloses it, so skipping a question is
    // a supported choice — the wording has to say so rather than nag.
    expect(options[0]).toHaveTextContent('Not provided');
    expect(options[0]).toHaveValue('');
    expect(select).toHaveValue('');
    expect(options).toHaveLength(OPTIONS.length + 1);
  });

  it('reports the chosen value, not its label', async () => {
    render(<Select label="Red blood cells" options={OPTIONS} defaultValue="" />);
    const select = screen.getByLabelText<HTMLSelectElement>('Red blood cells');

    await userEvent.selectOptions(select, 'abnormal');
    expect(select).toHaveValue('abnormal');
  });

  it('can be returned to "not provided" after an answer', async () => {
    render(<Select label="Pus cell clumps" options={OPTIONS} defaultValue="normal" />);
    const select = screen.getByLabelText<HTMLSelectElement>('Pus cell clumps');

    await userEvent.selectOptions(select, '');
    expect(select).toHaveValue('');
  });
});

describe('Progress', () => {
  it('announces a position a person can act on', () => {
    render(<Progress value={2} max={6} label="Assessment progress" valueText="Step 2 of 6" />);
    const bar = screen.getByRole('progressbar', { name: 'Assessment progress' });

    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '6');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    // "33" is true and useless; the phrasing is what gets announced.
    expect(bar).toHaveAttribute('aria-valuetext', 'Step 2 of 6');
    expect(screen.getByText('Step 2 of 6')).toBeVisible();
  });

  it('clamps a value outside the range instead of overflowing the bar', () => {
    const { rerender } = render(<Progress value={99} max={6} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6');

    rerender(<Progress value={-4} max={6} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('survives a nonsensical max rather than dividing by zero', () => {
    render(<Progress value={1} max={0} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
  });
});

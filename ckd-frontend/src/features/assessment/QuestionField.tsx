import { fieldCopy } from '../../content/fields';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Tooltip } from '../../components/ui/Tooltip';
import { rangeHint, type FieldSchema } from './field-schema';

interface QuestionFieldProps {
  field: FieldSchema;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/**
 * One question.
 *
 * Everything visible here is assembled from two sources and neither is this file:
 * the control type, bounds, and allowed values come from `field` (derived from
 * `/openapi.json`), and the wording comes from `content/fields.ts`. If the backend
 * names a field we have no copy for, the raw field name is shown rather than the
 * question being dropped — a question the model will impute silently is worse than
 * one with an ugly label.
 *
 * Numeric inputs use `inputMode="decimal"` rather than `type="number"`: the spinner
 * is a 20 px target, scroll-wheel changes to a lab value are a real hazard, and
 * `type="number"` silently discards input it dislikes instead of letting the field
 * report why it is invalid.
 */
export function QuestionField({ field, value, error, onChange }: QuestionFieldProps) {
  const copy = fieldCopy(field.name);
  const label = copy?.label ?? field.name;

  const help = copy && (
    <Tooltip label={`What is ${copy.clinicalName}?`}>
      <span className="block font-medium">{copy.clinicalName}</span>
      <span className="mt-1 block">{copy.help}</span>
    </Tooltip>
  );

  if (field.kind === 'categorical') {
    return (
      <Select
        label={label}
        options={field.values.map((value) => ({ value, label: optionLabel(value) }))}
        value={value}
        error={error}
        optional
        hint={copy?.where}
        tooltip={help}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  const range = rangeHint(field);
  const hint = [copy?.where, range].filter(Boolean).join(' · ');

  return (
    <Input
      label={label}
      // `text` with a decimal keypad: see the note above on `type="number"`.
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      error={error}
      optional
      hint={hint === '' ? undefined : hint}
      suffix={copy?.unit === '' ? undefined : copy?.unit}
      tooltip={help}
      onChange={(event) => onChange(event.target.value)}
      onClear={() => onChange('')}
    />
  );
}

/**
 * Present a backend enum value as a person would read it.
 *
 * A lookup, not a transformation, for the values that are not English words —
 * `notpresent` must not reach a user as "Notpresent". Anything unrecognised falls
 * through capitalised, so a new enum value the backend adds is still readable
 * before this map is updated.
 */
const OPTION_LABELS: Record<string, string> = {
  normal: 'Normal',
  abnormal: 'Abnormal',
  present: 'Present',
  notpresent: 'Not present',
  yes: 'Yes',
  no: 'No',
  good: 'Good',
  poor: 'Poor',
};

function optionLabel(value: string): string {
  return OPTION_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

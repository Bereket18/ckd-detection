import { fieldCopy } from '../../content/fields';
import { Badge } from '../../components/ui/Badge';
import type { FieldSchema } from './field-schema';

interface ReviewStepProps {
  fields: readonly FieldSchema[];
  answers: Record<string, string>;
  answeredCount: number;
  onJumpTo: (name: string) => void;
}

/**
 * The last step: what will be sent, and what will be estimated.
 *
 * This exists because the imputation disclosure on the result page arrives too
 * late to act on. Seeing "17 of your 24 answers will be estimated" *before*
 * submitting is what lets someone decide to go and fetch their lab report instead
 * of accepting a result built mostly from population averages.
 *
 * Unanswered fields are listed rather than counted, and each one is a button back to
 * its question — a summary that names a problem without offering a route to it just
 * moves the hunting to the user.
 */
export function ReviewStep({ fields, answers, answeredCount, onJumpTo }: ReviewStepProps) {
  const missing = fields.filter((field) => (answers[field.name] ?? '') === '');
  const answered = fields.filter((field) => (answers[field.name] ?? '') !== '');

  return (
    <div className="mt-2 space-y-6">
      <p className="text-sm text-ink-muted">
        You answered {answeredCount} of {fields.length} questions. The remaining{' '}
        {missing.length} will be estimated by the model from the data it was trained
        on, and your result will list exactly which ones.
      </p>

      {answered.length > 0 && (
        <section aria-labelledby="review-answered" className="space-y-2">
          <h3 id="review-answered" className="text-sm font-semibold text-ink">
            Your answers
          </h3>
          <dl className="divide-y divide-border rounded-md border border-border">
            {answered.map((field) => {
              const copy = fieldCopy(field.name);
              return (
                <div
                  key={field.name}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2"
                >
                  <dt className="text-sm text-ink-muted">{copy?.label ?? field.name}</dt>
                  <dd className="text-sm font-medium text-ink">
                    {answers[field.name]}
                    {copy?.unit ? <span className="text-ink-subtle"> {copy.unit}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      {missing.length > 0 && (
        <section aria-labelledby="review-missing" className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="review-missing" className="text-sm font-semibold text-ink">
              Will be estimated
            </h3>
            <Badge tone="warn">{missing.length}</Badge>
          </div>
          <ul className="flex flex-wrap gap-2">
            {missing.map((field) => (
              <li key={field.name}>
                <button
                  type="button"
                  onClick={() => onJumpTo(field.name)}
                  className="min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm text-ink hover:bg-surface-sunken"
                >
                  {fieldCopy(field.name)?.label ?? field.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-subtle">
            Selecting one of these takes you back to its question. Leaving them blank
            is a valid choice — the result will simply carry more uncertainty.
          </p>
        </section>
      )}
    </div>
  );
}

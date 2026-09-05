import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { buttonClasses } from '../../components/ui/styles';
import { fieldCopy } from '../../content/fields';

/**
 * What the model filled in for you.
 *
 * The service reports `imputed_fields` and `imputation_count` on every response, and
 * a result built from 17 estimated values out of 24 is a materially weaker result
 * than one built from 24 answered ones. Reporting only the count would be a half
 * disclosure — the fields are named, using the same patient-facing labels the
 * questions used, so the list is recognisable as "the questions I skipped".
 *
 * When nothing was imputed this renders a short positive confirmation rather than
 * nothing at all: "every value came from you" is information, and its absence would
 * leave the user unsure whether the check ran.
 */
export function ImputationNotice({
  imputedFields,
  imputationCount,
  totalFields,
}: {
  imputedFields: readonly string[];
  imputationCount: number;
  totalFields: number;
}) {
  if (imputationCount === 0) {
    return (
      <Alert tone="success" title="Every value came from you">
        Nothing was estimated. This result is based entirely on the {totalFields} values
        you entered.
      </Alert>
    );
  }

  // `imputation_count` is the number the service reports; `imputed_fields` is the
  // list it names. They should agree, and the count is trusted over the list length
  // because the count is what the service computed.
  return (
    <Alert
      tone="warn"
      title={`${imputationCount} of ${totalFields} values were estimated, not measured`}
      actions={
        <Link to="/assessment" className={buttonClasses('secondary', 'sm')}>
          Add the missing values
        </Link>
      }
    >
      <p>
        You left these blank, so the model substituted typical values from its training
        data. Each one makes this result less about you and more about the average
        person in that dataset. Filling any of them in and running the assessment again
        will give a result the model can stand behind more firmly.
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {imputedFields.map((name) => (
          <li
            key={name}
            className="rounded border border-border-strong bg-surface px-2 py-0.5 text-xs text-ink"
          >
            {fieldCopy(name)?.label ?? name}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

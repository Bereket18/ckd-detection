import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, Scale } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SkeletonText } from '../components/ui/Skeleton';
import { buttonClasses } from '../components/ui/styles';
import { ARTICLES } from '../content/education';
import { STEP_FIELD_ORDER, fieldCopy } from '../content/fields';
import { useModelMetadata } from '../lib/query/hooks';

/**
 * `/learn`.
 *
 * The education area, and the honest answer to "what should I do before I start?".
 * It stands on its own: nothing here needs a prediction, a health check, or a loaded
 * model, so it is the one page that still works when the service is down.
 *
 * The measurement reference is the exception, and it is driven from
 * `/model.feature_schema` rather than from the editorial list (ADR-7). If the model
 * gains or loses a field, this page follows — a glossary that still explains a
 * measurement the model no longer asks for is worse than one that is briefly
 * incomplete. The editorial order is used only as a fallback when the request has not
 * landed, so the page is never empty while waiting.
 */
export default function LearnRoute() {
  const model = useModelMetadata();
  const names = model.data?.feature_schema ?? STEP_FIELD_ORDER;

  return (
    <RouteShell
      title="Learn"
      description="What chronic kidney disease is, how it is normally detected, and what each of the measurements in the assessment actually tells a clinician. Nothing on this page needs a result — it is written to be read first."
    >
      <Alert tone="info" title="This is education, not advice">
        Everything below describes how kidney disease is understood and measured in
        general. None of it is a statement about you, and none of it is a reason to start,
        stop, or change any treatment. That conversation belongs to a clinician who can
        see your history.
      </Alert>

      {ARTICLES.map((entry) => (
        <section key={entry.id} id={entry.id} aria-labelledby={`${entry.id}-heading`} className="space-y-4">
          <SectionHeader
            id={`${entry.id}-heading`}
            title={entry.title}
            description={entry.summary}
          />
          <div className="max-w-(--container-prose) space-y-3">
            {entry.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-base text-ink">
                {paragraph}
              </p>
            ))}
          </div>
          {entry.points !== undefined && (
            /*
              `dl > div > dt/dd` is the one wrapper HTML permits inside a description
              list, so `Card` is that div rather than sitting inside another one. A
              second level of nesting is invalid and breaks the term/definition
              pairing for a screen reader.
            */
            <dl className="grid gap-3 sm:grid-cols-2">
              {entry.points.map((point) => (
                <Card key={point.term} padding="md" className="h-full">
                  <dt className="text-sm font-semibold text-ink">{point.term}</dt>
                  <dd className="mt-1 text-sm text-ink-muted">{point.detail}</dd>
                </Card>
              ))}
            </dl>
          )}
        </section>
      ))}

      <section aria-labelledby="glossary-heading" className="space-y-4">
        <SectionHeader
          id="glossary-heading"
          title="What each measurement means"
          description={
            model.isSuccess
              ? `The ${names.length} measurements this model asks for, in the order it expects them, with where to find each one on a lab report.`
              : 'The measurements the assessment asks for, with where to find each one on a lab report.'
          }
        />

        {model.isPending && <SkeletonText lines={4} />}

        <dl className="divide-y divide-border rounded-lg border border-border bg-surface">
          {names.map((name) => {
            const copy = fieldCopy(name);
            return (
              <div key={name} className="space-y-1 p-4">
                <dt className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-ink">{copy?.label ?? name}</span>
                  {copy?.unit ? (
                    <span className="text-sm text-ink-subtle">measured in {copy.unit}</span>
                  ) : null}
                  <span className="font-mono text-xs text-ink-subtle">{name}</span>
                </dt>
                <dd className="space-y-1 text-sm">
                  {copy === undefined ? (
                    <p className="text-ink-muted">
                      This model asks for <span className="font-mono">{name}</span>, and this
                      version of the app has no plain-language description for it yet. It is
                      still collected and sent exactly as the model expects.
                    </p>
                  ) : (
                    <>
                      <p className="text-ink">{copy.help}</p>
                      <p className="text-ink-muted">
                        <span className="font-medium text-ink">Where to find it:</span>{' '}
                        {copy.where}
                      </p>
                      <p className="text-ink-subtle">
                        On a lab report it may be printed as {copy.clinicalName}.
                      </p>
                    </>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        {model.isError && (
          <p className="text-sm text-ink-muted">
            The list above is this app’s own copy of the questions, shown because the
            service could not be reached to confirm its current field list. The assessment
            itself always reads the list from the service and will not run without it.
          </p>
        )}
      </section>

      <Card padding="lg" as="section" aria-labelledby="next-heading">
        <CardHeader
          level={2}
          title={<span id="next-heading">Where to go next</span>}
          description="Two useful directions, depending on what you came here for."
        />
        <div className="flex flex-wrap gap-3">
          <Link to="/assessment" className={buttonClasses('primary', 'md')}>
            <ClipboardList aria-hidden className="size-4" />
            Start the assessment
          </Link>
          <Link to="/model-card" className={buttonClasses('secondary', 'md')}>
            <Scale aria-hidden className="size-4" />
            How this model was built and tested
          </Link>
          <Link to="/about" className={buttonClasses('ghost', 'md')}>
            <BookOpen aria-hidden className="size-4" />
            What this tool is for
          </Link>
        </div>
      </Card>
    </RouteShell>
  );
}

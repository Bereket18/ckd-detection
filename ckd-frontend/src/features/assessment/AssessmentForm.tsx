import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Progress } from '../../components/ui/Progress';
import { SkeletonText } from '../../components/ui/Skeleton';
import { useHealth, useModelMetadata, useOpenApi } from '../../lib/query/hooks';
import { usePredictOne } from '../../lib/query/mutations';
import { usePrediction } from '../../lib/state/prediction-context';
import { clearDraft, createDraftWriter, readDraftRaw } from '../../lib/storage/draft';
import { normalizeError, type NormalizedError } from '../../lib/api';
import type { PatientAssessment } from '../../types/api.types';
import { QuestionField } from './QuestionField';
import { ReviewStep } from './ReviewStep';
import { buildSteps, type BuiltStep } from './steps';
import { indexFields, validateAnswer, type FieldSchema } from './field-schema';

/** Raw form state: one string per field, `''` meaning "not provided". */
type Answers = Record<string, string>;

/**
 * The assessment.
 *
 * The form is built at runtime from the backend's own contract — field identity and
 * order from `/model.feature_schema`, bounds and allowed values from
 * `/openapi.json` — so nothing here knows there are 24 questions. Adding a feature
 * to the model adds a question to this form with no frontend change; removing one
 * removes the question rather than submitting a field the API now rejects.
 *
 * Three rules shape the interaction, and all three come from the fact that a person
 * answering this will not have every value to hand:
 *
 * - **A blank answer is a valid answer.** The service imputes what is missing and
 *   reports what it imputed, so nothing is required and progress is never blocked
 *   by an empty field — only by a value that is genuinely out of range.
 * - **Answers survive a refresh but not the tab.** The draft lives in
 *   `sessionStorage` under one key; the prediction never does.
 * - **A degraded service blocks submission before the user types.** Finding out
 *   after filling in a lab report that the model was never loaded is the worst
 *   possible ordering.
 */
export function AssessmentForm() {
  const navigate = useNavigate();
  const health = useHealth();
  const model = useModelMetadata();
  const openapi = useOpenApi();
  const { setPrediction } = usePrediction();
  const predict = usePredictOne();

  /**
   * The draft is restored in the initial state, not in an effect.
   *
   * It has to be: an effect that sets state after the schema arrives is a second
   * render pass over a form the user may already be typing into, and it would
   * overwrite the first thing they typed. Reading it here happens once, before
   * anything is on screen.
   *
   * Unfiltered on the way in — `/model` has not answered yet, so there is no field
   * list to filter against. Nothing needs one: the payload is built from
   * `feature_schema`, the draft writer drops unknown keys, and only fields the
   * schema names are ever rendered. A stale key sits in state and goes nowhere.
   */
  const [answers, setAnswers] = useState<Answers>(() => {
    const draft = readDraftRaw();
    if (draft === null) return {};
    const restored: Answers = {};
    for (const [key, value] of Object.entries(draft)) {
      restored[key] = value === null ? '' : String(value);
    }
    return restored;
  });
  const [errors, setErrors] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const stepChanged = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);

  const featureSchema = model.data?.feature_schema;
  const steps = useMemo(
    () => buildSteps(featureSchema ?? [], openapi.data),
    [featureSchema, openapi.data]
  );
  const allFields = useMemo(() => steps.flatMap((step) => step.fields), [steps]);
  const fieldNames = useMemo(() => allFields.map((field) => field.name), [allFields]);
  const fieldIndex = useMemo(() => indexFields(allFields), [allFields]);

  const writer = useMemo(() => createDraftWriter(fieldNames), [fieldNames]);
  // Flush on unmount so answers typed within the debounce window are not lost by
  // navigating away, and cancel the pending timer so it cannot fire afterwards.
  useEffect(() => () => writer.flush(), [writer]);

  // Move focus to the new step's heading — on a change, never on first paint.
  // Without this the whole step changes beneath a screen reader with nothing
  // announced, and a keyboard user's focus stays on the *Continue* button that is
  // now further down a different step.
  useEffect(() => {
    if (stepChanged.current) stepHeading.current?.focus();
    else stepChanged.current = true;
  }, [stepIndex]);

  const setAnswer = (name: string, value: string) => {
    const next = { ...answers, [name]: value };
    setAnswers(next);
    writer.write(next);
    setShowEmptyWarning(false);

    // Validate as the user leaves an invalid state, never as they enter one: an
    // error appearing on the first keystroke of "1.5" (at "1") is noise.
    const field = fieldIndex.get(name);
    if (!field) return;
    const message = validateAnswer(field, value);
    setErrors((previous) => {
      if (message === null && previous[name] === undefined) return previous;
      const next = { ...previous };
      if (message === null) delete next[name];
      else next[name] = message;
      return next;
    });
  };

  const answeredCount = fieldNames.filter((name) => (answers[name] ?? '') !== '').length;
  const invalidNames = Object.keys(errors);

  const reset = () => {
    writer.cancel();
    clearDraft();
    setAnswers({});
    setErrors({});
    setShowEmptyWarning(false);
    setStepIndex(0);
    predict.reset();
  };

  const submit = () => {
    // Validate everything, not just the current step: a value can become invalid
    // only by being typed, but the draft was restored from a previous session and
    // was never checked against today's bounds.
    const found: Answers = {};
    for (const field of allFields) {
      const message = validateAnswer(field, answers[field.name] ?? '');
      if (message !== null) found[field.name] = message;
    }
    setErrors(found);

    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid !== undefined) {
      const index = steps.findIndex((step) => step.fields.some((f) => f.name === firstInvalid));
      if (index >= 0) setStepIndex(index);
      return;
    }

    if (answeredCount === 0) {
      // Not a validation error: the API would accept an all-null body and impute
      // every field, returning a result derived entirely from population averages.
      // That is a number about nobody, so it is refused here rather than shown.
      setShowEmptyWarning(true);
      return;
    }

    // Built once and reused, so what is shown on Results is provably the same
    // object that was sent — not a second build from state that may have moved on.
    const payload = buildPayload(allFields, answers);

    predict.mutate(payload, {
      onSuccess: (view) => {
        setPrediction(view, payload);
        // The draft's purpose was to survive a refresh mid-assessment. Once the
        // answers have been submitted, keeping them is storing patient data for no
        // remaining reason (§8.5).
        writer.cancel();
        clearDraft();
        navigate('/results');
      },
      onError: (error) => {
        // A 422 names the fields it rejected. Map them back onto the questions and
        // land the user on the first one, rather than reporting "some values are
        // wrong" and leaving them to hunt.
        if (error.fieldErrors === undefined) return;
        const mapped: Answers = {};
        for (const fieldError of error.fieldErrors) {
          if (fieldIndex.has(fieldError.field)) mapped[fieldError.field] = fieldError.message;
        }
        if (Object.keys(mapped).length === 0) return;
        setErrors(mapped);
        const first = Object.keys(mapped)[0];
        const index = steps.findIndex((step) => step.fields.some((f) => f.name === first));
        if (index >= 0) setStepIndex(index);
      },
    });
  };

  // The schema is the form. Until both documents have arrived there is no question
  // to render, and guessing at one would mean hardcoding the thing ADR-7 forbids.
  if (model.isPending || openapi.isPending) {
    return (
      <LoadingState label="Loading the assessment questions">
        <div className="space-y-6">
          <SkeletonText lines={2} />
          <SkeletonText lines={5} />
        </div>
      </LoadingState>
    );
  }

  if (model.isError || openapi.isError || steps.length === 0) {
    // `steps.length === 0` on a successful pair of requests is a contract failure,
    // not an empty form: the service answered without describing its own fields.
    const schemaError: NormalizedError = model.isError
      ? model.error
      : openapi.isError
        ? normalizeError(openapi.error)
        : {
            kind: 'contract',
            title: 'The questions could not be prepared',
            message:
              'The service answered, but did not describe the fields it expects. No question is being shown rather than a guessed one.',
            retryable: true,
          };

    return (
      <ErrorState
        error={schemaError}
        onRetry={() => {
          void model.refetch();
          void openapi.refetch();
        }}
      />
    );
  }

  const totalPages = steps.length + 1;
  const isReview = stepIndex >= steps.length;
  const step: BuiltStep | undefined = steps[stepIndex];
  const pageTitle = isReview ? 'Review and submit' : (step?.title ?? '');

  return (
    <div className="space-y-8">
      <Progress
        label="Assessment progress"
        value={stepIndex + 1}
        max={totalPages}
        valueText={`Step ${stepIndex + 1} of ${totalPages} — ${pageTitle}`}
      />

      {!health.ready && health.state !== 'checking' && (
        <Alert tone="warn" title="This cannot be submitted right now">
          {health.state === 'degraded'
            ? 'The service is running but its model is not loaded, so no assessment can be scored. Your answers are kept in this tab — try again shortly.'
            : 'We cannot reach the screening service. Your answers are kept in this tab, so you can submit once the connection returns.'}
        </Alert>
      )}

      {predict.isError && predict.error && (
        <ErrorState
          error={predict.error}
          onRetry={predict.error.retryable ? submit : undefined}
        />
      )}

      {showEmptyWarning && (
        <Alert tone="warn" title="Answer at least one question first">
          Every question can be skipped, but not all of them at once — with nothing to
          go on the model would return a result based entirely on population averages,
          which would say nothing about you.
        </Alert>
      )}

      <Card padding="lg" as="section" aria-labelledby="step-heading">
        {/*
          `tabIndex={-1}` so the step-change effect can move focus here without
          adding the heading to the tab order.
        */}
        <h2
          id="step-heading"
          ref={stepHeading}
          tabIndex={-1}
          className="text-xl font-semibold text-ink"
        >
          {pageTitle}
        </h2>

        {isReview ? (
          <ReviewStep
            fields={allFields}
            answers={answers}
            answeredCount={answeredCount}
            onJumpTo={(name) => {
              const index = steps.findIndex((s) => s.fields.some((f) => f.name === name));
              if (index >= 0) setStepIndex(index);
            }}
          />
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-muted">{step?.description}</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {(step?.fields ?? []).map((field) => (
                <QuestionField
                  key={field.name}
                  field={field}
                  value={answers[field.name] ?? ''}
                  error={errors[field.name]}
                  onChange={(value) => setAnswer(field.name, value)}
                />
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          icon={<ArrowLeft aria-hidden className="size-4" />}
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          Back
        </Button>

        {isReview ? (
          <Button
            variant="primary"
            loading={predict.isPending}
            loadingLabel="Scoring your answers…"
            disabled={!health.ready}
            onClick={submit}
          >
            Get my result
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={<ArrowRight aria-hidden className="size-4" />}
            iconPosition="end"
            onClick={() => setStepIndex((index) => Math.min(steps.length, index + 1))}
          >
            Continue
          </Button>
        )}

        <Button
          variant="ghost"
          icon={<RotateCcw aria-hidden className="size-4" />}
          onClick={reset}
          className="ms-auto"
        >
          Start over
        </Button>
      </div>

      <p className="text-xs text-ink-subtle">
        {answeredCount} of {fieldNames.length} questions answered.
        {invalidNames.length > 0 &&
          ` ${invalidNames.length} value${invalidNames.length === 1 ? '' : 's'} need${invalidNames.length === 1 ? 's' : ''} attention.`}{' '}
        Anything left blank is estimated by the model and listed on your result. Your
        answers stay in this tab and are never saved to your device.
      </p>
    </div>
  );
}

/**
 * Build the request body.
 *
 * An empty answer becomes `null`, not an omitted key: `PatientAssessment` declares
 * every field, and sending the field explicitly as null is what marks it as
 * "missing, please impute" rather than relying on a default. Numeric fields are
 * converted here and nowhere else.
 */
function buildPayload(fields: readonly FieldSchema[], answers: Answers): PatientAssessment {
  const payload: Record<string, string | number | null> = {};
  for (const field of fields) {
    const raw = (answers[field.name] ?? '').trim();
    if (raw === '') {
      payload[field.name] = null;
    } else if (field.kind === 'numeric') {
      payload[field.name] = Number(raw);
    } else {
      payload[field.name] = raw;
    }
  }
  return payload as unknown as PatientAssessment;
}

import { RouteShell } from '../components/layout/RouteShell';

/**
 * `/assessment` — shell only.
 *
 * The form itself is Phase 3. It is not stubbed with inputs here, because a form
 * that accepts answers and cannot submit them is worse than no form: a user would
 * enter real health values and lose them.
 */
export default function AssessmentRoute() {
  return (
    <RouteShell
      title="Assessment"
      description="A short set of questions about your health and any recent lab results. Every question can be skipped — a missing value is estimated by the model and the result says which values were estimated."
      planned={[
        {
          title: 'Guided multi-step form',
          detail:
            'The 24 questions grouped into steps, with progress shown. Field names and order come from the backend’s feature schema; ranges and allowed values come from its OpenAPI document. Nothing about the schema is written into the frontend.',
        },
        {
          title: '“I don’t know” on every question',
          detail:
            'An explicit way to leave a value out, rather than an empty box that looks like an unfinished task. Submission is blocked only by values that are invalid, never by values that are absent.',
        },
        {
          title: 'Plain-language help per question',
          detail:
            'What the measurement is, where to find it on a lab report, and why it matters — editorial copy held in the frontend and checked against the backend’s field list by a test.',
        },
        {
          title: 'Draft kept in this tab',
          detail:
            'In-progress answers are held in sessionStorage so a refresh does not lose them, and are cleared when the assessment is submitted or reset. Nothing is written to localStorage.',
        },
        {
          title: 'Submission and validation feedback',
          detail:
            'A 422 from the service is mapped back onto the specific questions it refers to. Wording comes from the error layer, never from the raw response.',
        },
      ]}
    />
  );
}

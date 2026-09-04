import { RouteShell } from '../components/layout/RouteShell';

/** `/learn` — shell for the education area. */
export default function LearnRoute() {
  return (
    <RouteShell
      title="Learn"
      description="What chronic kidney disease is, how it is normally detected, and what each of the measurements in the assessment actually tells a clinician."
      planned={[
        {
          title: 'What CKD is and why it is missed',
          detail:
            'Plain-language articles covering the condition, its stages, and why early kidney disease usually has no symptoms.',
        },
        {
          title: 'A page per measurement',
          detail:
            'Each of the values the assessment asks for: what it measures, what a typical range looks like, and where to find it on a lab report. Written from the backend’s field list so it cannot drift out of step with the model.',
        },
        {
          title: 'How to read a risk band',
          detail:
            'What a band does and does not say, why a screening score is not a probability, and what a clinician would do next.',
        },
        {
          title: 'How this model works',
          detail:
            'A non-technical account of the model, the data it was trained on, and its limitations — cross-linked to the model card.',
        },
      ]}
    />
  );
}

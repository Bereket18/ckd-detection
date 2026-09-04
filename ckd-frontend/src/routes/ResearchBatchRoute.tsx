import { RouteShell } from '../components/layout/RouteShell';

/**
 * `/research/batch` — shell for CSV batch scoring.
 *
 * Deliberately in the research area and not in the assessment path. The endpoint is
 * real and implemented, but scoring a file of records is a research activity; putting
 * it beside a patient's own single assessment would blur what the tool is for.
 */
export default function ResearchBatchRoute() {
  return (
    <RouteShell
      eyebrow="Research Lab"
      title="Batch scoring"
      description="Score a CSV of de-identified records against the deployed model. Intended for research and evaluation, not for screening an individual."
      planned={[
        {
          title: 'Upload and column checking',
          detail:
            'A CSV whose columns are checked against the backend’s feature schema before anything is sent, so a mismatch is reported here rather than as a server error.',
        },
        {
          title: 'Per-row results',
          detail:
            'A table of verdicts, bands, and drivers for each row, with the same labelling rules as a single result.',
        },
        {
          title: 'Row-level error reporting',
          detail:
            'The service reports rejected rows by index; the file’s own line numbers are what a person needs. Rows are reported by line, with the offending column named.',
        },
        {
          title: 'Wrong file type',
          detail:
            'Uploading something that is not a CSV is answered with specific guidance, not a raw status code — and never with the service’s own message, which can contain server paths.',
        },
      ]}
    />
  );
}

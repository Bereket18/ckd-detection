import { RouteShell } from '../components/layout/RouteShell';
import { StatusLegend } from '../components/provenance/StatusLabel';
import { SectionHeader } from '../components/ui/SectionHeader';

/**
 * `/about` — scope, data handling, and the label legend.
 *
 * The legend is real content, not a shell: the five labels are already in use across
 * the navigation and on two route banners, and a label a reader cannot look up is
 * decoration. This is the page it is looked up on.
 */
export default function AboutRoute() {
  return (
    <RouteShell
      title="About EthioCKD"
      description="A screening aid built around explainability: it reports a risk band, names the values that moved it, and states what it cannot tell you."
      planned={[
        {
          title: 'Who built this and why',
          detail:
            'The project’s origin, its scope, and the clinical framing it was designed against.',
        },
        {
          title: 'Accessibility statement',
          detail:
            'The standard targeted, what has been tested, and how to report something that does not work.',
        },
      ]}
    >
      <section aria-labelledby="about-data" className="space-y-4">
        <SectionHeader
          id="about-data"
          title="What happens to your answers"
          description="The short version: they are used to get one result, and then they are gone."
        />
        <ul className="max-w-(--container-prose) list-disc space-y-2 ps-5 text-sm text-ink-muted">
          <li>
            Your answers are sent to the screening service to be scored, and are held in this
            browser tab while you look at the result.
          </li>
          <li>
            Nothing is written to your device’s long-term storage. Closing the tab discards the
            answers and the result.
          </li>
          <li>
            A result is not saved anywhere by this site. If you want to keep one, you will need to
            save it yourself.
          </li>
          <li>
            No account, no tracking, and no analytics on what you entered. Requests and responses
            are not logged in the browser.
          </li>
        </ul>
      </section>

      <section aria-labelledby="about-limits" className="space-y-4">
        <SectionHeader
          id="about-limits"
          title="What this tool is not"
          description="Stated here as well as on every result, because it is the thing most easily misread."
        />
        <ul className="max-w-(--container-prose) list-disc space-y-2 ps-5 text-sm text-ink-muted">
          <li>It does not diagnose chronic kidney disease.</li>
          <li>
            Its score is not a probability. A higher score means the model saw a stronger pattern,
            not that a percentage of people like you have the condition.
          </li>
          <li>
            It cannot replace a laboratory test. Confirming kidney function requires blood and urine
            work a clinician orders.
          </li>
          <li>
            An explanation describes how the model reached its estimate. It is not evidence of a
            cause.
          </li>
        </ul>
      </section>

      <section aria-labelledby="about-labels" className="space-y-4">
        <SectionHeader
          id="about-labels"
          title="How data is labelled"
          description="Every figure on this site carries one of five labels. An unlabelled figure is a verified one — returned by the service during your session."
        />
        <StatusLegend />
      </section>
    </RouteShell>
  );
}

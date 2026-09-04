import { Link } from 'react-router-dom';
import {
  Accessibility,
  Contrast,
  Eye,
  Keyboard,
  Languages,
  Ruler,
  Stethoscope,
  User,
} from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLegend } from '../components/provenance/StatusLabel';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses } from '../components/ui/styles';
import { LANGUAGE_NAMES, REVIEW_NOTE } from '../content/patient-summary';

/**
 * `/about` — scope, data handling, the label legend, the design rules, and the
 * accessibility statement.
 *
 * Two of these sections exist because of a rule the project applies to itself: a
 * claim a reader cannot check is decoration. The label legend is where the five
 * provenance labels used across the navigation are defined, and the design
 * principles section is where the choices that look opinionated — no percentage, no
 * saved history, plain language by default — are written down with the reason
 * attached, so they can be argued with rather than guessed at.
 *
 * The principles live in the product rather than in a markdown file in the repo. A
 * design system nobody outside the team can read is a private document; the people
 * most affected by these particular decisions are the ones using the tool.
 */

interface Audience {
  title: string;
  detail: string;
  icon: typeof User;
}

const AUDIENCES: readonly Audience[] = [
  {
    title: 'Someone checking their own risk',
    detail:
      'The primary reader. Gets plain language by default, in English or Amharic, with the four questions answered: what this means, why it said that, how it decided, and when to see someone.',
    icon: User,
  },
  {
    title: 'A clinician or health worker',
    detail:
      'Can switch any result to its technical view — the raw score, every driver with its direction, which fields were imputed, and the exact model version — and print a one-page report to keep with a file.',
    icon: Stethoscope,
  },
  {
    title: 'Anyone auditing the claims',
    detail:
      'Every figure carries a label, the model card reports the metrics the service returns, and the research area lists what this service does not expose rather than filling the gap with plausible numbers.',
    icon: Eye,
  },
];

interface Principle {
  title: string;
  rule: string;
  applied: string;
}

const PRINCIPLES: readonly Principle[] = [
  {
    title: 'Label anything that is not measured',
    rule: 'A number with no stated origin is a number a reader has to trust blindly.',
    applied:
      'Five labels, defined above, and they appear on the page rather than in documentation. Two pages are permanently marked SIMULATION because no endpoint exists behind them.',
  },
  {
    title: 'The band leads, the number follows',
    rule: 'A raw model score is not a probability, and a percentage is read as one.',
    applied:
      'Results open with the risk band the service returned. The score appears on a labelled 0-to-1 scale, never as a percentage, and is never recomputed into one.',
  },
  {
    title: 'Plain language is the default state',
    rule: 'The person the result is about should not have to decode it to read it.',
    applied:
      'Every result opens in plain language. The technical view is one control away and nothing that changes the answer is hidden inside either view.',
  },
  {
    title: '“I don’t know” is a valid answer',
    rule: 'Forms that demand complete data get invented data, which is worse than missing data.',
    applied:
      'Every field can be left blank. The service imputes it, the result says how many values were estimated, and the plain-language copy explains what that costs.',
  },
  {
    title: 'One primary action per screen',
    rule: 'Two equally weighted buttons make the reader decide before they understand the choice.',
    applied:
      'One filled button per view. Everything else is secondary, ghost, or a link — including on the overview, where the only primary action is starting an assessment.',
  },
  {
    title: 'Colour is never the only signal',
    rule: 'Roughly one in twelve men cannot separate the two colours a risk scale most wants to use.',
    applied:
      'Every band carries its word and an icon as well as its colour. Every diagram pairs a line style with a written label.',
  },
  {
    title: 'Nothing persists unless asked for',
    rule: 'A screening answer is a health record, and health records should not accumulate silently.',
    applied:
      'Results live in memory for one visit. Nothing patient-related is written to long-term browser storage, and closing the tab is a complete delete.',
  },
  {
    title: 'Empty is explained, never blank',
    rule: 'A blank panel is indistinguishable from a broken one.',
    applied:
      'Pages that need a result say so and offer the assessment. Pages with no data source say what is missing and what would have to exist first.',
  },
  {
    title: 'Small screens first',
    rule: 'The phone is the likely device, so it is the design target rather than a late adaptation.',
    applied:
      'Every layout is built from 320 px upward, tap targets are at least 44 px, and wide content scrolls inside a focusable region instead of shrinking below legibility.',
  },
  {
    title: 'Print is a real surface',
    rule: 'The result leaves this site on paper, and the caveats have to leave with it.',
    applied:
      'The report is generated in the browser with its own print styles, and the disclaimer and limitations are printed on the page — not shown on screen and dropped from the paper.',
  },
];

interface AccessibilityItem {
  title: string;
  detail: string;
  icon: typeof Keyboard;
}

const ACCESSIBILITY: readonly AccessibilityItem[] = [
  {
    title: 'Keyboard only, start to finish',
    detail:
      'The assessment can be completed, submitted, and read without a mouse. A skip link is the first focusable element on every page, and focus is visible on every control.',
    icon: Keyboard,
  },
  {
    title: 'Contrast and text size',
    detail:
      'Body text is at least 14 px and colour pairs are chosen for a 4.5:1 ratio against their background. Text is never placed on colour alone to carry meaning.',
    icon: Contrast,
  },
  {
    title: 'Targets you can hit',
    detail:
      'Every button, link-button, and form control is at least 44 px on its smallest side — the size a thumb needs, not the size a cursor needs.',
    icon: Ruler,
  },
  {
    title: 'Announced, not just displayed',
    detail:
      'Results announce themselves politely when they arrive, errors are announced as alerts, every input has a programmatic label, and each diagram carries a full-sentence description.',
    icon: Accessibility,
  },
];

export default function AboutRoute() {
  return (
    <RouteShell
      title="About EthioCKD"
      description="A screening aid built around explainability: it reports a risk band, names the values that moved it, and states what it cannot tell you."
      planned={[
        {
          title: 'Authorship and institutional review',
          detail:
            'Who built this, under what supervision, and what clinical review it has had are not documented here yet. Until they are, treat it as unreviewed software.',
        },
        {
          title: 'An independent accessibility audit',
          detail:
            'The statement below describes what was built and checked by the team. No external audit and no testing session with screen-reader users has taken place.',
        },
      ]}
    >
      <section aria-labelledby="about-who" className="space-y-4">
        <SectionHeader
          id="about-who"
          title="Who this is for"
          description="Three readers, one response. The difference is how much of it is shown."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {AUDIENCES.map((audience) => {
            const Icon = audience.icon;
            return (
              <Card key={audience.title} padding="md" as="article" className="h-full">
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Icon aria-hidden className="size-4 text-accent" />
                  {audience.title}
                </h3>
                <p className="mt-1.5 text-sm text-ink-muted">{audience.detail}</p>
              </Card>
            );
          })}
        </div>
      </section>

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

      <section aria-labelledby="about-principles" className="space-y-4">
        <SectionHeader
          id="about-principles"
          title="The design rules this follows"
          description="Ten decisions, each with the reason attached. They are here rather than in an internal document because the people most affected by them are the people using the tool."
        />
        <ol className="grid gap-3 lg:grid-cols-2">
          {PRINCIPLES.map((principle, index) => (
            <li key={principle.title}>
              <Card padding="md" as="article" className="h-full">
                <h3 className="flex items-start gap-2.5 text-base font-semibold text-ink">
                  <span
                    aria-hidden
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink"
                  >
                    {index + 1}
                  </span>
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">{principle.rule}</p>
                <p className="mt-2 border-t border-border pt-2 text-sm text-ink">
                  <span className="font-medium">Here: </span>
                  <span className="text-ink-muted">{principle.applied}</span>
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="about-a11y" className="space-y-4">
        <SectionHeader
          id="about-a11y"
          title="Accessibility"
          description="The target is WCAG 2.1 Level AA. What follows is what was built and checked, not a certification."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {ACCESSIBILITY.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} padding="md" as="article" className="h-full">
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Icon aria-hidden className="size-4 text-accent" />
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm text-ink-muted">{item.detail}</p>
              </Card>
            );
          })}
        </div>
        <Alert tone="info" title="If something here does not work for you">
          The gap this statement cannot close is testing with real assistive technology and real
          users. Nothing on this site has been through that. If a control cannot be reached, a
          label is missing, or text is unreadable at your settings, that is a defect in this
          software rather than a limitation on your side.
        </Alert>
      </section>

      <section aria-labelledby="about-language" className="space-y-4">
        <SectionHeader
          id="about-language"
          title="Language"
          description="Result explanations are written in English and Amharic. The translation’s review status is stated in both, rather than only in the English."
          aside={<Languages aria-hidden className="size-5 text-ink-subtle" />}
        />
        <Card padding="lg" as="article">
          <CardHeader
            level={3}
            title="Translation status"
            description="A translation good enough to read is not automatically good enough to act on, and clinical wording is exactly where that gap bites."
          />
          <dl className="max-w-(--container-prose) space-y-3 text-sm">
            <div>
              <dt className="font-medium text-ink">{LANGUAGE_NAMES.en}</dt>
              <dd className="mt-1 text-ink-muted">{REVIEW_NOTE.en}</dd>
            </div>
            <div lang="am">
              <dt className="font-medium text-ink">{LANGUAGE_NAMES.am}</dt>
              <dd className="mt-1 text-base text-ink-muted">{REVIEW_NOTE.am}</dd>
            </div>
          </dl>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link to="/assessment" className={buttonClasses('primary', 'md')}>
          Start an assessment
        </Link>
        <Link to="/model-card" className={buttonClasses('secondary', 'md')}>
          What the deployed model is
        </Link>
        <Link to="/learn" className={buttonClasses('ghost', 'md')}>
          Learn about CKD
        </Link>
      </div>
    </RouteShell>
  );
}

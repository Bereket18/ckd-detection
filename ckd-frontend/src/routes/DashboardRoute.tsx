import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  FileText,
  Languages,
  ListChecks,
  Sigma,
  Sparkles,
  User,
} from 'lucide-react';
import { NAV_GROUPS } from '../components/layout/nav';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLabel } from '../components/provenance/StatusLabel';
import { Card, CardHeader } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses } from '../components/ui/styles';
import { BandChip } from '../features/results/BandChip';
import { useHealth, useModelMetadata } from '../lib/query/hooks';
import { usePrediction } from '../lib/state/prediction-context';

/**
 * `/` — the overview.
 *
 * Design brief for this page, in one line: a first-time visitor should learn what
 * happens to them and what happens to their data before they click anything.
 *
 * Four decisions worth recording:
 *
 * - **One primary action.** *Start an assessment* is the only filled button above the
 *   fold. Everything else is secondary or a link. A dashboard with six equal calls to
 *   action makes the reader choose before they understand the choice.
 * - **The story is numbered, not implied.** Answer → score → read → take it to a
 *   clinician. Each step also states what happens to the data at that step, because
 *   "is this being stored?" is the question people actually hold while typing lab
 *   values into a website.
 * - **Status is a line, not a widget.** When the service is healthy this page says so
 *   in one sentence with the model name and version behind it. When it is not, the
 *   application banner above already carries the warning, so this page defers to it
 *   rather than shouting twice.
 * - **No metric, no chart, no score.** Nothing is shown here that would look like a
 *   result. The only numbers on this page describe the deployed model, and they come
 *   from `/model`.
 */

interface Step {
  ordinal: string;
  title: string;
  detail: string;
  /** What happens to the person's data at this step. */
  data: string;
  icon: typeof ClipboardList;
}

const STEPS: readonly Step[] = [
  {
    ordinal: '1',
    title: 'You answer what you know',
    detail:
      'Questions about your health and your recent laboratory results, grouped into short steps. Anything you do not know can be left blank.',
    data: 'Answers stay in this browser tab while you work. Nothing is uploaded until you submit.',
    icon: ClipboardList,
  },
  {
    ordinal: '2',
    title: 'The model scores it',
    detail:
      'One request to the screening service. It returns a risk band, a score on a 0-to-1 scale, and the values that moved that score the most.',
    data: 'Sent once, scored, and returned. There is no account, and no record is created for you.',
    icon: Sparkles,
  },
  {
    ordinal: '3',
    title: 'You read it two ways',
    detail:
      'A plain-language explanation of what the result means and when to act, or the technical view with the score, the drivers, and the model behind it.',
    data: 'The result is held in memory for this visit only. Reloading the page clears it.',
    icon: User,
  },
  {
    ordinal: '4',
    title: 'You take it to a clinician',
    detail:
      'A printable one-page report of the same result, with its limitations printed on it so nobody downstream mistakes it for a diagnosis.',
    data: 'The report is built in your browser from the result you already have. No server involved.',
    icon: FileText,
  },
];

/**
 * Service readiness, stated once, quietly.
 *
 * `HealthBanner` owns the unhealthy cases at application level. Repeating that
 * warning here would be the second of two identical alarms, so this defers to it and
 * only adds what the banner cannot: which model is loaded, at which version.
 */
function ServiceStrip() {
  const health = useHealth();
  const model = useModelMetadata();

  if (health.state === 'checking') {
    return (
      <p className="text-sm text-ink-subtle">Checking whether the screening service is available…</p>
    );
  }

  if (!health.ready) {
    return (
      <p className="max-w-(--container-prose) text-sm text-ink-muted">
        The screening service is not available right now — the notice at the top of the page says
        which case this is. Everything else here still works, and you can read up while you wait.
      </p>
    );
  }

  const info = model.data;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
        <BadgeCheck aria-hidden className="size-4 text-success" />
        Screening service ready
      </span>
      {info === undefined ? (
        <span>Model details could not be loaded. Scoring is unaffected.</span>
      ) : (
        <>
          <span aria-hidden>·</span>
          <span>
            <span className="font-mono text-ink">{info.name}</span>, version{' '}
            <span className="font-mono text-ink">{info.version}</span>, {info.feature_count} fields
          </span>
          <StatusLabel provenance="verified" />
        </>
      )}
    </div>
  );
}

/**
 * The result you already have, if there is one.
 *
 * Renders nothing when there is no prediction — an empty "your result" tile on a
 * first visit would imply a result exists and failed to load. When one does exist,
 * this is the fastest route back to it, and it repeats the one fact about it that
 * surprises people: it is gone on reload.
 */
function ResumeSection() {
  const { prediction, receivedAt } = usePrediction();
  if (prediction === null) return null;

  const time =
    receivedAt === null
      ? null
      : new Date(receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <section aria-labelledby="resume-heading" className="space-y-4">
      <SectionHeader
        id="resume-heading"
        title="You have a result open in this session"
        description="Pick up where you left off. Nothing was saved to your device."
      />
      <Card padding="lg" as="article">
        <div className="flex flex-wrap items-center gap-3">
          <BandChip band={prediction.risk_band} />
          <p className="text-sm text-ink-muted">
            Scored{time === null ? '' : ` at ${time}`} in this tab. Reloading or closing it clears
            the result for good.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/results" className={buttonClasses('primary', 'md')}>
            Open your result
          </Link>
          <Link to="/explainability" className={buttonClasses('secondary', 'md')}>
            Why it said that
          </Link>
          <Link to="/report" className={buttonClasses('ghost', 'md')}>
            Printable report
          </Link>
        </div>
      </Card>
    </section>
  );
}

export default function DashboardRoute() {
  return (
    <RouteShell
      title="Chronic kidney disease risk screening"
      documentTitle="Overview"
      description="Answer what you know about your health and recent lab results. The model returns a risk band, names the values that influenced it, and states plainly what it cannot tell you. It is a screening aid, not a diagnosis."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/assessment" className={buttonClasses('primary', 'lg')}>
            Start an assessment
          </Link>
          <Link to="/learn" className={buttonClasses('secondary', 'lg')}>
            Learn about CKD first
          </Link>
        </div>
        <ServiceStrip />
      </div>

      <ResumeSection />

      <section aria-labelledby="story-heading" className="space-y-4">
        <SectionHeader
          id="story-heading"
          title="What happens, step by step"
          description="Four steps, a few minutes, and no account. Each step also says what happens to your answers at that point."
        />
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.ordinal}>
                <Card padding="md" as="article" className="h-full">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white"
                    >
                      {step.ordinal}
                    </span>
                    <Icon aria-hidden className="size-4 text-accent" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-ink">
                    <span className="sr-only">Step {step.ordinal}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{step.detail}</p>
                  <p className="mt-3 border-t border-border pt-3 text-xs text-ink-subtle">
                    {step.data}
                  </p>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card padding="lg" as="article">
          <CardHeader
            level={3}
            title="Useful to have to hand"
            description="None of it is required. Every blank is filled with a typical value and disclosed on the result."
            aside={<ListChecks aria-hidden className="size-5 text-accent" />}
          />
          <ul className="space-y-2 text-sm text-ink-muted">
            <li>A recent blood test report, if you have one — creatinine, urea, haemoglobin.</li>
            <li>A urine test report, for albumin and sugar.</li>
            <li>A recent blood pressure reading.</li>
            <li>
              Whether you have been told you have diabetes, high blood pressure, or heart disease.
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-subtle">
            No lab results at all? The assessment still runs, and the result will say how much of it
            was estimated rather than measured.
          </p>
        </Card>
        <Card padding="lg" as="article">
          <CardHeader
            level={3}
            title="One result, two readings"
            description="The same response, rendered for the person it is about or for the clinician reading it with them."
            aside={<Sigma aria-hidden className="size-5 text-accent" />}
          />
          <ul className="space-y-3 text-sm text-ink-muted">
            <li className="flex gap-2.5">
              <User aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <strong className="font-semibold text-ink">Plain language.</strong> What this means,
                why it said that, how it decided, and when to see someone — in English or Amharic.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Sigma aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <span>
                <strong className="font-semibold text-ink">Technical detail.</strong> The raw score
                on its 0–1 scale, every SHAP driver with its direction and magnitude, imputed fields,
                and the model version that produced it.
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <section aria-labelledby="amharic-heading" className="space-y-4">
        <SectionHeader
          id="amharic-heading"
          title="በአማርኛ"
          description="A short orientation in Amharic. The full result explanation is available in Amharic too."
          aside={<Languages aria-hidden className="size-5 text-ink-subtle" />}
        />
        <Card padding="lg" as="article">
          <div lang="am" className="max-w-(--container-prose) space-y-2 text-base text-ink-muted">
            <p>
              ይህ መሣሪያ የኩላሊት ሕመም ሊኖርብዎ የሚችልበትን ዕድል ለመመልከት የሚያገለግል የምልከታ (ስክሪኒንግ) እርዳታ ነው።
              የሕክምና ውሳኔ አይሰጥም፤ ምርመራንም አይተካም።
            </p>
            <p>
              የሚያውቁትን ብቻ ይሙሉ። የማያውቁትን ባዶ መተው ይችላሉ፤ መሣሪያው በተለመዱ ግምታዊ ቁጥሮች ሞልቶ
              ስንት ቁጥር እንደተገመተ በውጤቱ ላይ ይነግርዎታል።
            </p>
            <p>
              መልሶችዎ በዚህ አሳሽ (ብራውዘር) ውስጥ ብቻ ይቆያሉ፤ ገጹን ሲዘጉ ወይም ሲያድሱ ይጠፋሉ። መዝገብ
              አይከፈትም፣ መረጃም አይቀመጥም።
            </p>
            <p>
              ውጤቱ በቀላል አማርኛ ማብራሪያ ይቀርባል — ምን ማለት እንደሆነ፣ ለምን እንደዚያ እንዳለ፣ እንዴት
              እንደወሰነ፣ እና ሐኪም መቼ ማየት እንዳለብዎ።
            </p>
          </div>
          <div className="mt-4">
            <Link to="/assessment" className={buttonClasses('secondary', 'md')}>
              ምዘናውን ይጀምሩ
            </Link>
          </div>
        </Card>
      </section>

      {NAV_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`overview-${group.id}`} className="space-y-4">
          <SectionHeader id={`overview-${group.id}`} title={group.label} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.items
              .filter((item) => item.to !== '/')
              .map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Card as="article" padding="md" className="h-full">
                      <div className="flex items-start gap-3">
                        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-ink">
                              <Link to={item.to} className="hover:text-accent-ink">
                                {item.label}
                              </Link>
                            </h3>
                            {item.provenance && <StatusLabel provenance={item.provenance} />}
                          </div>
                          <p className="text-sm text-ink-muted">{item.summary}</p>
                          <Link
                            to={item.to}
                            className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink"
                          >
                            Open
                            <ArrowRight aria-hidden className="size-4" />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </RouteShell>
  );
}

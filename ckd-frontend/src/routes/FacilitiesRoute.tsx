import { Link } from 'react-router-dom';
import { Droplet, FileText, Languages, TestTube } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses } from '../components/ui/styles';

/**
 * `/facilities` — permanently labelled PLANNED.
 *
 * No provider has been chosen, so there is no data source and no list. The
 * constraints in `planned` are written down now rather than later because they are
 * exactly the ones that get lost once a map library is added: a location lookup that
 * quietly sends assessment answers to a third party, or stores precise coordinates,
 * is a far worse privacy failure than the feature is worth.
 *
 * What the page does carry is the part that needs no data source at all. A person who
 * has just been told "higher risk" has one practical question — *what do I ask for?*
 * — and the answer is two named laboratory tests. That is useful without a single
 * facility record, and it is deliberately phrased as what to request rather than what
 * to do about the result.
 */
export default function FacilitiesRoute() {
  return (
    <RouteShell
      title="Find care nearby"
      documentTitle="Find care"
      description="A screening result is not a diagnosis — confirming it needs a laboratory test. This page will help you find somewhere to get one. Until it does, here is what to ask for when you get there."
      provenance="planned"
      provenanceNote="No facility data source has been selected yet, so nothing is listed here. This page shows no locations rather than example ones, because a made-up clinic is worse than an empty page."
      planned={[
        {
          title: 'A named data source',
          detail:
            'A specific provider of facility data, chosen and documented before any list appears. Until one is chosen there is nothing to show.',
        },
        {
          title: 'Location only if you ask',
          detail:
            'Your location will be requested explicitly, with the reason stated, and the page will work without it — searching by area name instead.',
        },
        {
          title: 'Your answers stay here',
          detail:
            'No part of your assessment, your result, or your risk band will ever be sent to a facility or map provider. The lookup only needs a place.',
        },
        {
          title: 'Coordinates are not kept',
          detail:
            'Precise coordinates will be used for the search and then discarded. They will not be stored on your device or sent anywhere else.',
        },
      ]}
    >
      <section aria-labelledby="ask-heading" className="space-y-4">
        <SectionHeader
          id="ask-heading"
          title="What to ask for"
          description="Two routine tests answer the question this tool cannot. Both are ordinary laboratory work, not specialist procedures."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="A creatinine blood test"
              description="Sometimes written as “serum creatinine” or reported together with eGFR."
              aside={<TestTube aria-hidden className="size-5 text-accent" />}
            />
            <p className="text-sm text-ink-muted">
              Creatinine is waste your kidneys clear from the blood. How much is left in a sample
              indicates how well that clearing is working — which is the measurement this screening
              only estimates from the numbers you typed.
            </p>
          </Card>
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="A urine protein or albumin test"
              description="Sometimes written as “urine albumin”, “ACR”, or part of a urinalysis."
              aside={<Droplet aria-hidden className="size-5 text-accent" />}
            />
            <p className="text-sm text-ink-muted">
              Healthy kidneys keep protein in the blood. Protein appearing in urine is one of the
              earliest signs of kidney damage, and it can show up before a person feels anything at
              all.
            </p>
          </Card>
        </div>
        <Alert tone="info" title="Why both, and not one">
          The two answer different questions — how well the kidneys are filtering, and whether they
          are leaking. Chronic kidney disease is defined by these findings persisting over time, so
          a clinician may repeat them after some weeks rather than deciding from a single day.
        </Alert>
      </section>

      <section aria-labelledby="where-heading" className="space-y-4">
        <SectionHeader
          id="where-heading"
          title="Where these are usually done"
          description="Stated in general terms, because this page names no specific place until a real data source is chosen."
        />
        <ul className="max-w-(--container-prose) list-disc space-y-2 ps-5 text-sm text-ink-muted">
          <li>
            A health centre or clinic can normally take blood and urine samples and send them to a
            laboratory.
          </li>
          <li>
            A general hospital laboratory usually runs both tests directly, often the same day.
          </li>
          <li>
            A private laboratory will accept a request without a referral in many places, and can
            give you the printed values to take to a clinician.
          </li>
          <li>
            Ask for the printed numbers whichever route you take. Those values are what a clinician
            interprets — and what you would enter here for a more specific screening.
          </li>
        </ul>
        <Card padding="lg" as="article">
          <CardHeader
            level={3}
            title="Take the result with you"
            description="A printed page is easier to hand over than a phone screen, and it carries the caveats with it."
            aside={<FileText aria-hidden className="size-5 text-accent" />}
          />
          <p className="text-sm text-ink-muted">
            If you have completed an assessment in this visit, the report page prints a one-page
            summary: the band, the values you gave, which of them the model leaned on, and the
            statement that it is not a diagnosis.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/report" className={buttonClasses('secondary', 'md')}>
              Printable report
            </Link>
            <Link to="/assessment" className={buttonClasses('ghost', 'md')}>
              Start an assessment
            </Link>
          </div>
        </Card>
      </section>

      <section aria-labelledby="facilities-amharic" className="space-y-4">
        <SectionHeader
          id="facilities-amharic"
          title="በአማርኛ"
          description="What to ask for, in Amharic."
          aside={<Languages aria-hidden className="size-5 text-ink-subtle" />}
        />
        <Card padding="lg" as="article">
          <div lang="am" className="max-w-(--container-prose) space-y-2 text-base text-ink-muted">
            <p>
              ይህ ገጽ ገና የጤና ተቋማትን ዝርዝር አያሳይም። የተረጋገጠ የመረጃ ምንጭ ስላልተመረጠ ሐሰተኛ ዝርዝር
              ከማሳየት ባዶ መተው ይሻላል።
            </p>
            <p>
              ወደ ጤና ተቋም ሲሄዱ ሁለት ምርመራዎችን ይጠይቁ፦ የደም <strong>ክሬቲኒን</strong> ምርመራ እና
              የሽንት <strong>ፕሮቲን (አልቡሚን)</strong> ምርመራ። ሁለቱም መደበኛ ምርመራዎች ናቸው።
            </p>
            <p>
              የምርመራውን ውጤት በጽሑፍ እንዲሰጥዎ ይጠይቁ። ቁጥሮቹ ለሐኪም አስፈላጊ ናቸው፤ በዚህ መሣሪያ
              ላይም ቢያስገቧቸው ውጤቱ ለእርስዎ የበለጠ የተለየ ይሆናል።
            </p>
          </div>
        </Card>
      </section>
    </RouteShell>
  );
}

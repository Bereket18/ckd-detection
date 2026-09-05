import { Link } from 'react-router-dom';
import {
  Ban,
  Braces,
  Layers,
  Microscope,
  ScanLine,
  ShieldAlert,
  TestTube,
  Users,
} from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLabel } from '../components/provenance/StatusLabel';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses } from '../components/ui/styles';
import { FusionDiagram } from '../features/multimodal/FusionDiagram';

/**
 * `/multimodal` — permanently labelled SIMULATION.
 *
 * The label is not provisional. Imaging and fusion weights exist on disk, but the
 * deployed API surface is `/health`, `/model`, `/predict`, and `/predict/batch` —
 * none of which accepts or returns an image. There is therefore no endpoint against
 * which a multimodal claim could ever be verified from the frontend, so the page is
 * educational by construction rather than pending a data source.
 *
 * Because there is nothing to report, the page teaches the one thing a reader can
 * actually take away: *where* two kinds of evidence can be joined, and why the join
 * is the hard part rather than the models on either side of it.
 */

interface FusionStrategy {
  name: string;
  where: string;
  strength: string;
  cost: string;
}

const STRATEGIES: readonly FusionStrategy[] = [
  {
    name: 'Early fusion',
    where: 'The raw measurements and the image features are concatenated into one input.',
    strength: 'The model can learn interactions between a scan feature and a lab value directly.',
    cost: 'Needs both kinds of data for every record, so any record missing one is unusable.',
  },
  {
    name: 'Joint fusion',
    where: 'Each kind of evidence is encoded separately, then the two representations are combined inside the network.',
    strength: 'Each encoder can be specialised, and the combination is learned rather than fixed.',
    cost: 'The most data-hungry of the three, and the hardest to explain to a clinician.',
  },
  {
    name: 'Late fusion',
    where: 'Two models score independently and their outputs are combined at the end.',
    strength: 'Either model works alone, so a record with only labs still gets a score.',
    cost: 'Interactions between the two kinds of evidence are lost — the combination cannot learn what neither model saw.',
  },
];

const STRATEGY_COLUMNS: readonly Column<FusionStrategy>[] = [
  {
    key: 'name',
    header: 'Approach',
    cell: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  { key: 'where', header: 'Where the joining happens', cell: (row) => row.where },
  { key: 'strength', header: 'What it buys', cell: (row) => row.strength },
  { key: 'cost', header: 'What it costs', cell: (row) => row.cost },
];

export default function MultimodalRoute() {
  return (
    <RouteShell
      title="Combining scans with lab results"
      documentTitle="Multimodal"
      description="How imaging and tabular measurements could be combined to assess kidney health, and why doing it well is harder than running two models and averaging them."
      provenance="simulation"
      provenanceNote="Everything on this page is an illustration of the method. No image is uploaded, no scan is analysed, and nothing here is connected to your assessment or to any patient record. The deployed service scores tabular measurements only, and this page reports no figure of any kind."
    >
      <section aria-labelledby="two-kinds-heading" className="space-y-4">
        <SectionHeader
          id="two-kinds-heading"
          title="Two kinds of evidence about one kidney"
          description="Each answers a question the other cannot, which is the entire reason to want both."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="Measurements"
              description="What the deployed model uses today."
              aside={<TestTube aria-hidden className="size-5 text-accent" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>Creatinine, urea, haemoglobin, albumin — numbers from a laboratory.</li>
              <li>Describe how well the kidneys are <em>working</em> right now.</li>
              <li>Cheap, routine, and comparable between visits.</li>
              <li>Say nothing about the shape, size, or structure of the organ.</li>
            </ul>
          </Card>
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="Images"
              description="Not part of this service."
              aside={<ScanLine aria-hidden className="size-5 text-ink-subtle" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>Ultrasound or CT — what the kidney looks like.</li>
              <li>
                Show <em>structure</em>: scarring, cysts, stones, a kidney that has shrunk.
              </li>
              <li>Can reveal a cause that blood values only hint at.</li>
              <li>Need equipment, a trained operator, and a reader.</li>
            </ul>
          </Card>
        </div>
        <Alert tone="info" title="Why combine them at all">
          A creatinine value says function is impaired; an image can say why. Neither replaces the
          other, and a model given both has a chance of separating a long-standing structural
          problem from an acute one — a distinction that changes what a clinician does next.
        </Alert>
      </section>

      <section aria-labelledby="diagram-heading" className="space-y-4">
        <SectionHeader
          id="diagram-heading"
          title="Where the two paths meet"
          description="The structure of a fusion model, drawn. This is the arrangement the diagram describes, not a description of the deployed service."
          aside={<StatusLabel provenance="simulation" />}
        />
        <FusionDiagram />
      </section>

      <section aria-labelledby="strategies-heading" className="space-y-4">
        <SectionHeader
          id="strategies-heading"
          title="Three places to join the evidence"
          description="The choice is not cosmetic: it decides which records can be used at all."
        />
        <DataTable
          caption="Fusion strategies, what each buys, and what each costs"
          columns={STRATEGY_COLUMNS}
          rows={STRATEGIES}
          rowKey={(row) => row.name}
        />
        <p className="max-w-(--container-prose) text-sm text-ink-muted">
          For a screening tool in a setting where imaging is not always available, late fusion is
          usually the honest choice — a person with lab values and no scan still gets a result,
          and the tool degrades rather than refusing to answer.
        </p>
      </section>

      <section aria-labelledby="hard-heading" className="space-y-4">
        <SectionHeader
          id="hard-heading"
          title="Why the pairing is the hard part"
          description="Not the models. The data."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="What a fusion dataset requires"
              aside={<Users aria-hidden className="size-5 text-ink-subtle" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>
                A scan and a blood panel from the <strong>same person</strong>, close enough in
                time that they describe the same state.
              </li>
              <li>An outcome label that applies to both.</li>
              <li>Enough such pairs to train on, not a handful.</li>
              <li>Consent covering both, and a linkage that survives de-identification.</li>
            </ul>
          </Card>
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="Why that is rare"
              aside={<Microscope aria-hidden className="size-5 text-ink-subtle" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>
                Labs live in one system and images in another, often with no shared identifier.
              </li>
              <li>Not everyone who has bloods drawn is scanned; scans are ordered for a reason.</li>
              <li>
                That reason biases the pairs: the scanned subset is sicker than the population the
                tool would be used on.
              </li>
              <li>
                De-identifying two linked records without breaking the link is harder than
                de-identifying either alone.
              </li>
            </ul>
          </Card>
        </div>
        <Alert tone="warn" title="The failure this page exists to prevent">
          A product can show a scan beside a result and imply the two were analysed together. This
          one does not: the service accepts no image, so any pairing shown here would be a picture
          of something that did not happen.
        </Alert>
      </section>

      <section aria-labelledby="real-heading" className="space-y-4">
        <SectionHeader
          id="real-heading"
          title="What would have to be true for this page to report anything"
          description="Stated as a dependency list so the gap is legible rather than implied."
          aside={<StatusLabel provenance="planned" />}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Braces,
              title: 'An endpoint that accepts an image',
              detail:
                'The four routes this service exposes take JSON and CSV. None accepts a file of pixels, so there is nothing for a frontend to call.',
            },
            {
              icon: Layers,
              title: 'A fusion model with reported evaluation',
              detail:
                'Weights on disk are not evidence. A number would need to come from an evaluation the service reports, the way tabular metrics do.',
            },
            {
              icon: ShieldAlert,
              title: 'A privacy review for images',
              detail:
                'A scan is identifying in ways a row of lab values is not. Uploading one raises questions this project has not answered, so it does not offer the option.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} padding="md" as="article" className="h-full">
                <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Icon aria-hidden className="size-4 text-ink-subtle" />
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm text-ink-muted">{item.detail}</p>
              </Card>
            );
          })}
        </div>
        <Card padding="lg" as="article">
          <CardHeader level={3} title="በአማርኛ በአጭሩ" description="The same point, in Amharic." />
          <div lang="am" className="max-w-(--container-prose) space-y-2 text-base text-ink-muted">
            <p>
              ይህ ገጽ የሚያብራራው ሐሳብ ብቻ ነው። የላብራቶሪ ውጤቶችና የምስል (ስካን) መረጃዎችን አጣምሮ የሚሠራ ሞዴል
              እንዴት እንደሚገነባ ያሳያል፤ አሁን የሚሠራው አገልግሎት ግን ምስል አይቀበልም።
            </p>
            <p>
              የላብራቶሪ ቁጥሮች ኩላሊት <em>እንዴት እየሠራ</em> እንደሆነ ይናገራሉ፤ ምስል ደግሞ ኩላሊቱ{' '}
              <em>ምን እንደሚመስል</em> ያሳያል። ሁለቱ የተለያዩ ጥያቄዎችን ይመልሳሉ።
            </p>
            <p>
              ማስታወሻ፦ በዚህ ገጽ ላይ ምንም ቁጥር ወይም ውጤት አልቀረበም። ምስል አይጫንም፣ አይመረመርም፣ ከእርስዎ
              ምዘና ጋርም ምንም ግንኙነት አይፈጠርም።
            </p>
          </div>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link to="/assessment" className={buttonClasses('primary', 'md')}>
          Use the service that does exist
        </Link>
        <Link to="/model-card" className={buttonClasses('secondary', 'md')}>
          What the deployed model is
        </Link>
        <Link to="/federated" className={buttonClasses('ghost', 'md')}>
          <Ban aria-hidden className="size-4" />
          The other simulation
        </Link>
      </div>
    </RouteShell>
  );
}

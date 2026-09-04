import { Ban, Building2, Lock, RefreshCw, Server, ShieldAlert, ShieldCheck } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLabel } from '../components/provenance/StatusLabel';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { SectionHeader } from '../components/ui/SectionHeader';
import { FederationDiagram } from '../features/federated/FederationDiagram';

/**
 * `/federated` — permanently labelled SIMULATION.
 *
 * Federated training code exists in this repository, but no route reaches it: the API
 * exposes no round, no per-site metric, and no aggregation result. So the page teaches
 * the method and reports nothing. Every claim on it is about how federated averaging
 * works in general; none of it describes a federation that exists.
 *
 * That constraint shaped the design rather than limiting it. With no numbers to show,
 * the page's job is to make one idea checkable — *what crosses the gap between two
 * hospitals* — which is a question a diagram and a two-column table answer better
 * than a dashboard would.
 */

interface Crossing {
  thing: string;
  crosses: 'no' | 'yes';
  detail: string;
}

const CROSSINGS: readonly Crossing[] = [
  {
    thing: 'Patient rows — names, ages, lab values',
    crosses: 'no',
    detail:
      'They are read where they are stored and are never transmitted. This is the whole point of the arrangement.',
  },
  {
    thing: 'The local dataset file',
    crosses: 'no',
    detail: 'No copy is made, so there is no second place for it to leak from.',
  },
  {
    thing: 'Model weights after local training',
    crosses: 'yes',
    detail:
      'A list of numbers describing the model, not the data. This is what a site sends.',
  },
  {
    thing: 'How many records the site trained on',
    crosses: 'yes',
    detail:
      'The averaging is weighted by it, so a site with more data counts for more. A count, not the records.',
  },
  {
    thing: 'The averaged shared model',
    crosses: 'yes',
    detail: 'Sent back to every site, which is how a small site benefits from a large one.',
  },
];

const CROSSING_COLUMNS: readonly Column<Crossing>[] = [
  { key: 'thing', header: 'What', cell: (row) => <span className="text-ink">{row.thing}</span> },
  {
    key: 'crosses',
    header: 'Leaves the hospital?',
    cell: (row) =>
      row.crosses === 'no' ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-success">
          <Lock aria-hidden className="size-4" />
          Never
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-semibold text-info">
          <Server aria-hidden className="size-4" />
          Yes
        </span>
      ),
  },
  { key: 'detail', header: 'Why', cell: (row) => <span className="text-ink-muted">{row.detail}</span> },
];

const STEPS: readonly { title: string; detail: string }[] = [
  {
    title: 'Every site starts from the same model',
    detail:
      'The coordinating server sends out one set of starting weights, so the sites are training the same thing rather than three unrelated models.',
  },
  {
    title: 'Each site trains on its own records, in its own building',
    detail:
      'The data is read locally. Nothing is uploaded, nothing is pooled, and no site can see another site’s patients.',
  },
  {
    title: 'Each site sends back an update, not data',
    detail:
      'What travels is the change to the model’s numbers, plus how many records it was computed from. A hospital sends arithmetic, not a patient list.',
  },
  {
    title: 'The server averages the updates',
    detail:
      'Weighted by each site’s record count — the procedure known as federated averaging. The server never sees a record, only the updates.',
  },
  {
    title: 'The shared model goes back out, and the round repeats',
    detail:
      'After enough rounds, every site holds a model shaped by all of the data, while each site’s records never moved.',
  },
];

export default function FederatedRoute() {
  return (
    <RouteShell
      title="Training one model across several hospitals"
      documentTitle="Federated learning"
      description="Federated learning trains a single model across several hospitals while each hospital’s records stay where they are. This page explains how a round works, what crosses the gap between sites, and what the arrangement does not protect you from."
      provenance="simulation"
      provenanceNote="This page describes the method. It shows no training run, no participating hospital, and no aggregated result, because the deployed service exposes none. Site A, B, and C are illustrations, not institutions, and no figure on this page came from a real federation."
    >
      <section aria-labelledby="diagram-heading" className="space-y-4">
        <SectionHeader
          id="diagram-heading"
          title="One round, in one picture"
          description="Three sites, one coordinating server, and a strict rule about what is allowed to move."
        />
        <FederationDiagram />
      </section>

      <section aria-labelledby="steps-heading" className="space-y-4">
        <SectionHeader
          id="steps-heading"
          title="The same round, step by step"
          description="This is the text equivalent of the diagram. Read either one."
        />
        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card padding="md" className="h-full">
                <div className="flex gap-3">
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-ink">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-muted">{step.detail}</p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="crossing-heading" className="space-y-4">
        <SectionHeader
          id="crossing-heading"
          title="What crosses the gap, and what never does"
          description="The claim worth checking. If a row in the first column ever moved, the arrangement would have failed at its only job."
        />
        <DataTable
          caption="What leaves a participating hospital during federated training"
          columns={CROSSING_COLUMNS}
          rows={CROSSINGS}
          rowKey={(row) => row.thing}
        />
      </section>

      <section aria-labelledby="compare-heading" className="space-y-4">
        <SectionHeader
          id="compare-heading"
          title="Why not simply pool the data?"
          description="Pooling is easier and it is what most machine learning does. Here is what each approach costs."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="Pooling into one dataset"
              aside={<Building2 aria-hidden className="size-5 text-ink-subtle" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>Simple to build, and the model sees everything at once.</li>
              <li>
                Requires every hospital to hand over patient records — the part that usually
                stops the project, and reasonably so.
              </li>
              <li>Creates one place where a breach exposes every site’s patients.</li>
              <li>Needs a legal basis for transferring records across institutions.</li>
            </ul>
          </Card>
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="Federated training"
              aside={<Server aria-hidden className="size-5 text-accent" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>Records never move, so no transfer agreement is needed for the data itself.</li>
              <li>A small clinic gets a model shaped by a large hospital’s data.</li>
              <li>Slower, and more moving parts: rounds, connectivity, version drift.</li>
              <li>
                Harder to debug — nobody can look at the combined data, which is precisely why
                it was allowed.
              </li>
            </ul>
          </Card>
        </div>
      </section>

      <section aria-labelledby="protect-heading" className="space-y-4">
        <SectionHeader
          id="protect-heading"
          title="What it protects, and what it does not"
          description="Federated learning is a data-movement guarantee, not a privacy guarantee. The difference matters and is often glossed over."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="What it does give you"
              aside={<ShieldCheck aria-hidden className="size-5 text-success" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>No raw record leaves the site that collected it.</li>
              <li>No central copy of the data exists to be stolen or subpoenaed.</li>
              <li>Each site keeps control, and can stop participating without recall.</li>
              <li>Sites too small to train alone can still contribute and benefit.</li>
            </ul>
          </Card>
          <Card padding="lg" as="article">
            <CardHeader
              level={3}
              title="What it does not"
              aside={<ShieldAlert aria-hidden className="size-5 text-warn" />}
            />
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>
                Updates can leak information about the data that produced them. Defending against
                that takes additional techniques — differential privacy, secure aggregation — and
                federated averaging alone does not include them.
              </li>
              <li>
                A dishonest participant can poison the shared model by sending bad updates.
              </li>
              <li>Bias in each site’s data survives averaging. It may even be reinforced.</li>
              <li>
                It says nothing about whether the model is any good. That is still measured the
                ordinary way, on a test set.
              </li>
            </ul>
          </Card>
        </div>
        <Alert tone="warn" title="Stated plainly">
          “The records never left the hospital” is a true and useful sentence. “Therefore the
          patients are anonymous” is not, and this project does not claim it.
        </Alert>
      </section>

      <section aria-labelledby="local-heading" className="space-y-4">
        <SectionHeader
          id="local-heading"
          title="Why this shape suits Ethiopian hospitals"
          description="The practical case for the arrangement, in the setting this project was built for."
        />
        <div className="max-w-(--container-prose) space-y-3 text-base text-ink">
          <p>
            Kidney screening data in Ethiopia sits in many places and in small amounts: a
            teaching hospital in Addis Ababa, a regional hospital, a district clinic with a few
            hundred records and no data science team. Individually, none of those is enough to
            train a model that generalises. Together they would be — if the records could be
            combined, which is exactly the thing that is hard to arrange and often should not be
            arranged.
          </p>
          <p>
            Federated training is a way to get the second thing without doing the first. Each
            site keeps custody of its patients’ records and contributes to a model none of them
            could build alone. Where connectivity is intermittent, a site that misses a round
            rejoins at the next one; nothing is lost by being briefly offline.
          </p>
          <p>
            The deployed model behind this application is not federated. It was trained on a
            single public dataset of four hundred records, and the model card says so. This page
            exists because the architecture the project is aiming at is the one drawn above, and
            because an application that talks about hospitals sharing a model should be able to
            explain what that actually involves.
          </p>
        </div>
        <Card padding="lg" as="article">
          <CardHeader level={3} title="በአማርኛ በአጭሩ" description="The same idea, in Amharic." />
          <div lang="am" className="max-w-(--container-prose) space-y-2 text-base text-ink-muted">
            <p>
              በዚህ ዘዴ የበርካታ ሆስፒታሎች መረጃ በአንድ ቦታ አይሰበሰብም። እያንዳንዱ ሆስፒታል በራሱ መዝገቦች ላይ ብቻ
              ሠልጥኖ የሚያገኘውን የሞዴል ቁጥሮች ብቻ ይልካል፤ የታካሚ መዝገቦች ከቦታቸው አይንቀሳቀሱም።
            </p>
            <p>
              መካከለኛው አገልጋይ የተላኩትን ቁጥሮች አማክሎ አንድ የተሻሻለ ሞዴል ይሠራና ለሁሉም ሆስፒታሎች ይመልሳል።
              በዚህም አነስተኛ መዝገብ ያለው ጤና ጣቢያ ከትልቁ ሆስፒታል መረጃ ተጠቃሚ ይሆናል።
            </p>
            <p>
              ማስታወሻ፦ ይህ ገጽ ዘዴውን ለማስረዳት የተዘጋጀ ማሳያ ነው። አሁን የሚሠራው ሞዴል በአንድ የሕዝብ መረጃ ስብስብ
              ላይ የሠለጠነ ነው፤ በእውነተኛ ሆስፒታሎች መካከል የተሠራ ስልጠና አይደለም።
            </p>
          </div>
        </Card>
      </section>

      <section aria-labelledby="real-heading" className="space-y-4">
        <SectionHeader
          id="real-heading"
          title="What would make this page report real rounds"
          description="Stated as a dependency rather than left as a gap, so nobody has to guess why there are no numbers here."
          aside={<StatusLabel provenance="planned" />}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Card padding="md" as="article" className="h-full">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <RefreshCw aria-hidden className="size-4 text-ink-subtle" />
              A round endpoint
            </h3>
            <p className="mt-1.5 text-sm text-ink-muted">
              Something like a per-round record of which sites took part and what the aggregate
              scored. The API surface today is four endpoints, none of them federated.
            </p>
          </Card>
          <Card padding="md" as="article" className="h-full">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Ban aria-hidden className="size-4 text-ink-subtle" />
              Until then, no numbers
            </h3>
            <p className="mt-1.5 text-sm text-ink-muted">
              This page will not display a site count, an accuracy, or a round number that the
              service did not return. The SIMULATION label stays until it can be replaced with a
              VERIFIED one.
            </p>
          </Card>
        </div>
      </section>
    </RouteShell>
  );
}

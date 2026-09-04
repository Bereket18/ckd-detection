import { RouteShell } from '../components/layout/RouteShell';

/**
 * `/multimodal` — permanently labelled SIMULATION.
 *
 * The label is not provisional. Imaging and fusion weights exist on disk, but the
 * deployed API surface is `/health`, `/model`, `/predict`, and `/predict/batch` —
 * none of which accepts or returns an image. There is therefore no endpoint against
 * which a multimodal claim could ever be verified from the frontend, so the page is
 * educational by construction rather than pending a data source.
 */
export default function MultimodalRoute() {
  return (
    <RouteShell
      title="Combining scans with lab results"
      documentTitle="Multimodal"
      description="How imaging and tabular measurements could be combined to assess kidney health, and why doing it well is harder than running two models and averaging them."
      provenance="simulation"
      provenanceNote="Everything on this page is an illustration of the method. No image is uploaded, no scan is analysed, and nothing here is connected to your assessment or to any patient record. The deployed service scores tabular measurements only."
      planned={[
        {
          title: 'How fusion works, illustrated',
          detail:
            'A walkthrough of the idea: two models, two kinds of evidence, and the ways their outputs can be combined.',
        },
        {
          title: 'Why pairing is the hard part',
          detail:
            'Why a scan and a blood panel from the same person at the same time is the requirement that makes multimodal datasets rare.',
        },
        {
          title: 'What would have to be true to make this real',
          detail:
            'The endpoint, the validation, and the evidence that would be needed before any of this could be labelled anything other than a simulation.',
        },
      ]}
    />
  );
}

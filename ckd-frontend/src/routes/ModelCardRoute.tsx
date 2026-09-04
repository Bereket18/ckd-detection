import { RouteShell } from '../components/layout/RouteShell';

/**
 * `/model-card` — shell.
 *
 * The version identifier shown here will be the `version` field the service returns
 * (the first twelve characters of the model file's hash, computed by the backend).
 * The frontend never slices the hash itself, and never renders an artifact's `path`
 * — the projection layer removes it before this route can see it.
 */
export default function ModelCardRoute() {
  return (
    <RouteShell
      title="Model card"
      description="What the deployed model is, how it was evaluated, and what it should not be used for."
      planned={[
        {
          title: 'Identity and intended use',
          detail:
            'The model type, the version identifier reported by the service, and a clear statement of who it is for and what it must not decide.',
        },
        {
          title: 'Training data and evaluation',
          detail:
            'Datasets, split sizes, and the evaluation block the service reports — shown as given, not recomputed.',
        },
        {
          title: 'Stated limitations',
          detail:
            'The limitations the service itself publishes, rendered as text. Chief among them: the score is not a calibrated probability.',
        },
        {
          title: 'Integrity, not location',
          detail:
            'Artifacts are identified by hash. The server file paths that the API happens to include are removed before this page receives the data, and are never displayed.',
        },
      ]}
    />
  );
}

import { Outlet, useLocation } from 'react-router-dom';
import { RouteShell } from '../components/layout/RouteShell';

/**
 * `/research` — the research area's index.
 *
 * Rendered as a layout with an `<Outlet />` so `/research/batch` nests beneath it in
 * the URL without inheriting this page's heading. The index content shows only when
 * the path is exactly `/research`; a nested route replaces it entirely, which keeps
 * one `<h1>` per page.
 *
 * The split between what this page can and cannot show is the sharpest example of
 * the plan's honesty rule. `/model` really does return dataset sizes and an
 * evaluation block, so those will carry a VERIFIED label. Model comparison,
 * threshold analysis, and federated results have no endpoint at all, so they are
 * listed as not built rather than filled with plausible figures.
 */
export default function ResearchRoute() {
  const { pathname } = useLocation();

  if (pathname !== '/research') return <Outlet />;

  return (
    <RouteShell
      title="Research Lab"
      description="What the deployed model was trained on and how it performed on its held-out test set, as reported by the service itself."
      planned={[
        {
          title: 'Dataset composition',
          detail:
            'Which datasets were used and how many rows went to training and testing. The service reports these, so they will be shown under a VERIFIED label.',
        },
        {
          title: 'Evaluation metrics',
          detail:
            'Accuracy, precision, recall, specificity, F1, AUC-ROC, Brier score, the confusion matrix, and the reported intervals — all read from the service, none recomputed here.',
        },
        {
          title: 'Model comparison',
          detail:
            'Comparing candidate models needs an endpoint that returns more than the deployed one. There is none, so no comparison will be shown until there is.',
        },
        {
          title: 'Threshold analysis',
          detail:
            'A threshold sweep exists in the training code but is not reachable through the API. Charting one from the frontend would mean inventing it.',
        },
      ]}
    />
  );
}

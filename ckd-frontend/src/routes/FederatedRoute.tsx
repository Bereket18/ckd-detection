import { RouteShell } from '../components/layout/RouteShell';

/**
 * `/federated` — permanently labelled SIMULATION.
 *
 * Federated training code exists in the repository, but no route reaches it: the
 * API exposes no federated round, no per-site metric, and no aggregation result. Any
 * number shown here would be invented, so the page explains the method instead of
 * reporting outcomes.
 */
export default function FederatedRoute() {
  return (
    <RouteShell
      title="Training without moving patient data"
      documentTitle="Federated learning"
      description="Federated learning trains one model across several hospitals while each hospital’s records stay where they are. This page explains how that works and what it costs."
      provenance="simulation"
      provenanceNote="This page describes the method. It shows no training run, no site, and no aggregated result, because the deployed service does not expose any. Nothing here reflects a real federation of hospitals."
      planned={[
        {
          title: 'The round, step by step',
          detail:
            'What each site computes, what is sent, what is aggregated, and what never leaves the building.',
        },
        {
          title: 'What it protects and what it does not',
          detail:
            'The privacy properties federated averaging actually gives you, and the attacks it does not defend against on its own.',
        },
        {
          title: 'Why it matters for Ethiopian hospitals',
          detail:
            'The practical case: small per-site datasets, real constraints on sharing records, and what a shared model could add.',
        },
        {
          title: 'Reporting real rounds',
          detail:
            'If the backend later exposes federated results, this page would show them under a VERIFIED label. Until such an endpoint exists, the simulation label stays.',
        },
      ]}
    />
  );
}

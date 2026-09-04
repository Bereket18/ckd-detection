import { RouteShell } from '../components/layout/RouteShell';

/**
 * `/facilities` — permanently labelled PLANNED.
 *
 * No provider has been chosen, so there is no data source and nothing is shown. The
 * constraints below are written down now rather than later because they are exactly
 * the ones that get lost once a map library is added: a location lookup that quietly
 * sends assessment answers to a third party, or stores precise coordinates, is a far
 * worse privacy failure than the feature is worth.
 */
export default function FacilitiesRoute() {
  return (
    <RouteShell
      title="Find care nearby"
      documentTitle="Find care"
      description="A screening result is not a diagnosis — confirming it needs a laboratory test. This page will help you find somewhere to get one."
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
    />
  );
}

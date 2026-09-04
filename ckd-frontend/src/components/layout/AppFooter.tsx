import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';
import { NAV_GROUPS } from './nav';

/**
 * Footer.
 *
 * Carries the standing disclaimer — the one sentence that must be true on every
 * page whether or not a prediction is on screen. The per-result disclaimer is a
 * different thing: it comes from the API's `disclaimer` field and is rendered on
 * Results verbatim. This one is the site's own and is not a substitute for it.
 */
export function AppFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface-sunken">
      <Container width="wide" className="space-y-8 py-10">
        <p className="max-w-(--container-prose) text-sm text-ink-muted">
          EthioCKD is a screening aid for research and education. It does not diagnose chronic
          kidney disease and is not a substitute for a clinician or a laboratory test. If you are
          concerned about your kidney health, speak to a health professional.
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wider text-ink-subtle uppercase">
                {group.label}
              </h2>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="text-sm text-ink-muted hover:text-accent-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-xs text-ink-subtle">
          Answers you enter stay in this browser tab. Nothing is stored after the tab is closed.
        </p>
      </Container>
    </footer>
  );
}

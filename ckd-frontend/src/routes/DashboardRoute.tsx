import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { NAV_GROUPS } from '../components/layout/nav';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLabel } from '../components/provenance/StatusLabel';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses } from '../components/ui/styles';

/**
 * `/` — the overview.
 *
 * Its whole job in Phase 2 is orientation: what this tool is, what it is not, and
 * where each section leads. The group cards are generated from `NAV_GROUPS`, so a
 * route added to the navigation appears here automatically instead of being
 * forgotten.
 *
 * No metrics, no score, no chart. There is nothing to show until a user has
 * submitted an assessment, and a dashboard of empty tiles would imply otherwise.
 */
export default function DashboardRoute() {
  return (
    <RouteShell
      title="Chronic kidney disease risk screening"
      documentTitle="Overview"
      description="Answer what you know about your health and recent lab results. The model returns a risk band, names the values that influenced it, and states plainly what it cannot tell you. It is a screening aid, not a diagnosis."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/assessment" className={buttonClasses('primary', 'lg')}>
          Start an assessment
        </Link>
        <Link to="/learn" className={buttonClasses('secondary', 'lg')}>
          Learn about CKD first
        </Link>
      </div>

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

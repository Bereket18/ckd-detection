import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { usePredictionValue } from '../../lib/state/prediction-context';
import { StatusLabel } from '../provenance/StatusLabel';
import { NAV_GROUPS } from './nav';

interface AppNavProps {
  /** Called after a link is followed — the mobile drawer closes on it. */
  onNavigate?: () => void;
  /** Shows each item's one-line summary. On in the drawer, off in the sidebar. */
  withSummaries?: boolean;
  className?: string;
}

/**
 * The application navigation, rendered from `NAV_GROUPS`.
 *
 * One component for both the desktop sidebar and the mobile drawer, so the two
 * cannot diverge. `<nav>` carries a name because a page may hold several landmarks
 * of the same type, and grouping uses real `<ul>`/`<li>` structure so a screen
 * reader announces "list, 4 items" instead of a run of unrelated links.
 *
 * Items that need a prediction stay visible and enabled when there is none. They
 * lead to an empty state that offers the assessment — which explains itself, where a
 * link that vanishes does not.
 */
export function AppNav({ onNavigate, withSummaries = false, className }: AppNavProps) {
  const prediction = usePredictionValue();

  return (
    <nav aria-label="Sections" className={cn('space-y-6', className)}>
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="space-y-1.5">
          <h2
            id={`nav-group-${group.id}`}
            className="px-3 text-xs font-semibold tracking-wider text-ink-subtle uppercase"
          >
            {group.label}
          </h2>
          <ul aria-labelledby={`nav-group-${group.id}`} className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const pending = item.needsPrediction === true && prediction === null;

              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/' || item.to === '/research'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        'duration-(--duration-fast) hover:bg-accent-soft',
                        isActive
                          ? 'bg-accent-soft font-semibold text-accent-ink'
                          : 'font-medium text-ink'
                      )
                    }
                  >
                    <Icon aria-hidden className="mt-0.5 size-4.5 shrink-0" />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {item.label}
                        {item.provenance && <StatusLabel provenance={item.provenance} />}
                      </span>
                      {withSummaries && (
                        <span className="block text-xs font-normal text-ink-muted">
                          {item.summary}
                        </span>
                      )}
                      {pending && (
                        <span className="block text-xs font-normal text-ink-subtle">
                          Available after an assessment
                        </span>
                      )}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

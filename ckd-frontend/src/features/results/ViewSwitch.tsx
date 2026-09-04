/**
 * The plain ↔ technical switch.
 *
 * Two audiences read the same response and need different things from it, so the
 * page holds both and lets the reader choose — rather than stacking a SHAP table
 * under a patient explanation and hoping the right person scrolls to the right
 * part.
 *
 * Design decisions worth stating:
 *
 * - **Plain is the default**, everywhere and always. The person who took the
 *   assessment is the primary reader; a clinician can find one control.
 * - **It is a switch, not a tab strip.** Tabs imply peer content of the same kind.
 *   These are two renderings of one object, so the control says which lens is on.
 * - **Nothing is hidden that changes the answer.** The band, the disclaimer, and the
 *   report link sit outside the switch, so no reading of the page can miss them.
 */

import { Sigma, User } from 'lucide-react';
import { cn } from '../../lib/cn';
import { patientCopy, type ResultView } from '../../content/patient-summary';

interface ViewSwitchProps {
  view: ResultView;
  onChange: (view: ResultView) => void;
}

/**
 * English labels: this control is page chrome, and the language switch it sits
 * above governs the patient copy rather than the frame around it.
 */
const LABELS = patientCopy('en').labels;

export function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  const options = [
    { value: 'plain' as const, label: LABELS.plainView, icon: User },
    { value: 'technical' as const, label: LABELS.technicalView, icon: Sigma },
  ];

  return (
    <div
      role="group"
      aria-label={LABELS.viewSwitchLabel}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === view;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-white'
                : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
            )}
          >
            <Icon aria-hidden className="size-4" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

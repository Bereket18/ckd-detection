/**
 * Page-level provenance banner.
 *
 * `/multimodal` and `/federated` must carry a *persistent* SIMULATION label, and
 * `/facilities` a persistent PLANNED one — persistent meaning it cannot be
 * dismissed and it is not below the fold. A dismissible banner would be a
 * one-click path to a screen that looks like a real clinical result, which is the
 * single failure mode the label exists to prevent.
 *
 * There is deliberately no `onDismiss`. Adding one would also require remembering
 * the dismissal, and the only place to remember it is `localStorage` (ADR-10).
 */

import { cn } from '../../lib/cn';
import { TONE_ICON, TONE_PANEL } from '../ui/styles';
import { PROVENANCE, type Provenance } from './provenance';
import { StatusGlyph } from './StatusGlyph';

interface ProvenanceBannerProps {
  provenance: Provenance;
  /** Page-specific sentence. The generic meaning is appended from PROVENANCE. */
  children?: React.ReactNode;
  className?: string;
}

export function ProvenanceBanner({ provenance, children, className }: ProvenanceBannerProps) {
  const meta = PROVENANCE[provenance];

  return (
    <aside
      // `note`, not `alert`: an alert interrupts, and this is standing context that
      // must not steal focus every time the route renders.
      role="note"
      aria-label={`${meta.label} notice`}
      className={cn('flex gap-3 rounded-lg border px-4 py-3', TONE_PANEL[meta.tone], className)}
    >
      <StatusGlyph
        provenance={provenance}
        className={cn('mt-0.5 size-5 shrink-0', TONE_ICON[meta.tone])}
      />
      <div className="space-y-1 text-sm">
        <p className="font-semibold tracking-wide">{meta.label}</p>
        <p className="text-ink-muted">{children ?? meta.description}</p>
      </div>
    </aside>
  );
}

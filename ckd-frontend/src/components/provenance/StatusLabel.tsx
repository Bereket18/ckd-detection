/**
 * The status chip and its legend.
 *
 * `StatusLabel` is the atom used everywhere a number, chart, or page needs its
 * provenance stated. `StatusLegend` explains all five in one place, because a
 * label the user cannot look up is decoration.
 */

import { cn } from '../../lib/cn';
import { TONE_CHIP } from '../ui/styles';
import { PROVENANCE, PROVENANCE_ORDER, type Provenance } from './provenance';
import { StatusGlyph } from './StatusGlyph';

interface StatusLabelProps {
  provenance: Provenance;
  size?: 'sm' | 'md';
  /** Appends the one-sentence meaning after the word, for banners and captions. */
  withDescription?: boolean;
  className?: string;
}

export function StatusLabel({
  provenance,
  size = 'sm',
  withDescription = false,
  className,
}: StatusLabelProps) {
  const meta = PROVENANCE[provenance];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        TONE_CHIP[meta.tone],
        className
      )}
    >
      <StatusGlyph provenance={provenance} className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      {/*
        Without this, a screen reader announces a bare word — "SIMULATION" — with
        no indication of what it qualifies. The visual chip gets that from its
        position; the audible one needs it said.
      */}
      <span className="sr-only">Data status: </span>
      {meta.label}
      {withDescription && (
        <span className="ms-1 font-normal normal-case tracking-normal">— {meta.description}</span>
      )}
    </span>
  );
}

/** The five labels and what each one claims. Rendered on /about and in help. */
export function StatusLegend({ className }: { className?: string }) {
  return (
    <dl className={cn('grid gap-4 sm:grid-cols-2', className)}>
      {PROVENANCE_ORDER.map((provenance) => (
        <div key={provenance} className="flex flex-col gap-1.5">
          <dt>
            <StatusLabel provenance={provenance} />
          </dt>
          <dd className="text-sm text-ink-muted">{PROVENANCE[provenance].description}</dd>
        </div>
      ))}
    </dl>
  );
}

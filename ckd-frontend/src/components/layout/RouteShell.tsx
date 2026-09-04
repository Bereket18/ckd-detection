import type { ReactNode } from 'react';
import { useDocumentTitle } from '../../lib/use-document-title';
import { ProvenanceBanner } from '../provenance/ProvenanceBanner';
import { StatusLabel } from '../provenance/StatusLabel';
import type { Provenance } from '../provenance/provenance';
import { Card } from '../ui/Card';
import { PageHeader } from '../ui/PageHeader';
import { SectionHeader } from '../ui/SectionHeader';

export interface PlannedItem {
  title: string;
  detail: string;
}

interface RouteShellProps {
  title: string;
  description: ReactNode;
  /** Falls back to `title`. Set it when the tab needs shorter wording. */
  documentTitle?: string;
  eyebrow?: ReactNode;
  /** A permanent label for the whole page — SIMULATION, PLANNED. */
  provenance?: Provenance;
  /** Page-specific wording for the banner. */
  provenanceNote?: ReactNode;
  /**
   * What this route will hold once its phase lands. Stated as prose, never as
   * placeholder numbers or empty chart frames — a grey rectangle where a metric
   * will go reads as a metric that failed to load.
   */
  planned?: readonly PlannedItem[];
  children?: ReactNode;
}

/**
 * The scaffold every route shares: document title, `h1`, purpose text, and its
 * provenance label.
 *
 * Phase 2 builds route *shells*. The honest way to present a shell is to say what
 * the page is for and what is not built yet, which is what `planned` renders — each
 * entry carrying a PLANNED label of its own so the page cannot be mistaken for a
 * finished one at a glance.
 */
export function RouteShell({
  title,
  description,
  documentTitle,
  eyebrow,
  provenance,
  provenanceNote,
  planned,
  children,
}: RouteShellProps) {
  useDocumentTitle(documentTitle ?? title);

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        description={description}
        eyebrow={eyebrow}
        aside={provenance && <StatusLabel provenance={provenance} size="md" />}
      />

      {provenance && (
        <ProvenanceBanner provenance={provenance}>{provenanceNote}</ProvenanceBanner>
      )}

      {children}

      {planned && planned.length > 0 && (
        <section aria-labelledby="planned-heading" className="space-y-4">
          <SectionHeader
            id="planned-heading"
            title="Not built yet"
            description="This page is a shell. The items below are specified but not implemented, and no data is being shown for them."
            aside={<StatusLabel provenance="planned" />}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {planned.map((item) => (
              <li key={item.title}>
                <Card padding="md" as="article" className="h-full">
                  <h3 className="text-base font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{item.detail}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

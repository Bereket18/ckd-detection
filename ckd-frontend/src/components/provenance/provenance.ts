/**
 * The provenance vocabulary — five labels, and nothing else.
 *
 * This is part of the trust model, not the styling layer. The product shows
 * numbers from a model trained on 400 records, alongside pages that are frankly
 * educational simulations, and the user has no way to tell those apart by looking.
 * The label is that way.
 *
 * The governing rule, from the plan: **an unlabelled number is a verified
 * number.** Anything that is not a value the backend returned in this session
 * must carry one of these five labels, so forgetting a label is a bug.
 *
 * Four redundant channels carry the meaning (R7.6):
 *   1. the word itself, always spelled out — never an icon alone;
 *   2. a distinct glyph *shape*, legible in monochrome and in forced-colors mode;
 *   3. containment — the chip's border and background separate it from prose;
 *   4. colour, last, and never on its own.
 *
 * Banned vocabulary, permanently: LIVE, REAL, DEMO, MOCK, BETA, COMING SOON.
 * Each either overclaims ("REAL", "LIVE"), implies a temporary state that a
 * research prototype cannot promise ("BETA", "COMING SOON"), or is developer
 * jargon a patient will not read correctly ("MOCK"). A test asserts none of them
 * appear in `src/`.
 */

import type { StatusTone } from '../ui/styles';

export type Provenance = 'verified' | 'provisional' | 'not-verified' | 'simulation' | 'planned';

export interface ProvenanceMeta {
  /** Displayed verbatim, in caps. Never abbreviated, never translated to an icon. */
  label: string;
  tone: StatusTone;
  /** One sentence, plain language, shown in the legend and as the chip's title. */
  description: string;
}

export const PROVENANCE: Record<Provenance, ProvenanceMeta> = {
  verified: {
    label: 'VERIFIED',
    // Not `success`: green on a screening product reads as clinical reassurance,
    // and this label is about where a number came from, not about the patient.
    tone: 'info',
    description: 'Returned by the backend API during this session.',
  },
  provisional: {
    label: 'PROVISIONAL',
    tone: 'warn',
    description:
      'Measured on a small single-source dataset. Indicative of the model, not of clinical performance.',
  },
  'not-verified': {
    label: 'NOT VERIFIED',
    tone: 'neutral',
    description: 'No backend source exists for this yet, so it cannot be confirmed.',
  },
  simulation: {
    label: 'SIMULATION',
    tone: 'warn',
    description: 'An illustration built to explain a concept. Not produced from patient data.',
  },
  planned: {
    label: 'PLANNED',
    tone: 'neutral',
    description: 'Specified but not built. Nothing on this page is functional yet.',
  },
};

/** Stable order for the legend: strongest claim first, weakest last. */
export const PROVENANCE_ORDER: readonly Provenance[] = [
  'verified',
  'provisional',
  'not-verified',
  'simulation',
  'planned',
];

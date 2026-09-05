/**
 * Status glyphs — five distinct *shapes*, drawn rather than imported.
 *
 * Lucide has a circled check and a dashed circle, but not a hatched square, and a
 * set assembled from three different icon metaphors does not read as one system.
 * Drawing all five here keeps the shape language deliberate and, more usefully,
 * keeps them distinguishable in monochrome: a filled disc, a half-filled disc, a
 * ring, a hatched square, and a dotted ring differ by silhouette alone.
 *
 * `currentColor` throughout, so the chip's tone drives the colour and
 * `forced-colors` mode substitutes the system colour without losing the shape.
 */

import type { Provenance } from './provenance';

interface GlyphProps {
  provenance: Provenance;
  className?: string;
}

export function StatusGlyph({ provenance, className }: GlyphProps) {
  // Decorative: the label text beside it already carries the meaning, so a second
  // announcement would just make every chip read twice.
  const shared = {
    viewBox: '0 0 16 16',
    'aria-hidden': true,
    focusable: false as const,
    className,
  };

  switch (provenance) {
    case 'verified':
      return (
        <svg {...shared}>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M4.5 8.4l2.2 2.2 4.8-4.8"
            fill="none"
            stroke="var(--color-surface)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'provisional':
      return (
        <svg {...shared}>
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
          {/* Half filled: the claim is half-supported. */}
          <path d="M8 1.6a6.4 6.4 0 0 0 0 12.8z" fill="currentColor" />
        </svg>
      );

    case 'not-verified':
      return (
        <svg {...shared}>
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M6 6.1a2 2 0 0 1 3.9.6c0 1.3-1.9 1.5-1.9 2.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="8" cy="12" r="0.95" fill="currentColor" />
        </svg>
      );

    case 'simulation':
      return (
        <svg {...shared}>
          {/* Hatching: the classic "not real material" convention from drafting. */}
          <rect x="1.6" y="1.6" width="12.8" height="12.8" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M2.4 9.6l7.2-7.2M4.6 13.6l9-9M8.8 14.4l5.6-5.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      );

    case 'planned':
      return (
        <svg {...shared}>
          {/* Dotted outline: an intention, not a thing. */}
          <circle
            cx="8"
            cy="8"
            r="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="2 2.2"
          />
        </svg>
      );
  }
}

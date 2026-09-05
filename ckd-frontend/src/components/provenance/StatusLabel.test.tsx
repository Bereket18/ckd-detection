import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusLabel, StatusLegend } from './StatusLabel';
import { PROVENANCE, PROVENANCE_ORDER } from './provenance';

/**
 * The status system is part of the trust model, so it is tested like one.
 *
 * Three properties are asserted, in order of how badly their absence would hurt:
 * the word is present as text; the shape differs per status so colour is never the
 * only channel; and the announced form says what the word qualifies.
 */
describe('StatusLabel', () => {
  it.each(PROVENANCE_ORDER)('renders %s as a word, not only a colour', (provenance) => {
    const { container } = render(<StatusLabel provenance={provenance} />);
    expect(screen.getByText(PROVENANCE[provenance].label)).toBeVisible();

    // Channel two: a drawn silhouette that survives monochrome and forced-colors.
    const glyph = container.querySelector('svg');
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
  });

  it('gives every status a distinct silhouette', () => {
    const shapes = PROVENANCE_ORDER.map((provenance) => {
      const { container, unmount } = render(<StatusLabel provenance={provenance} />);
      const markup = container.querySelector('svg')?.innerHTML ?? '';
      unmount();
      return markup;
    });

    // Five statuses, five different drawings. Two identical glyphs would leave
    // colour doing the work alone for that pair.
    expect(new Set(shapes).size).toBe(PROVENANCE_ORDER.length);
    for (const shape of shapes) expect(shape.length).toBeGreaterThan(0);
  });

  it('announces what the word qualifies', () => {
    render(<StatusLabel provenance="simulation" />);
    // Without this a screen reader announces a bare "SIMULATION" with no subject.
    expect(screen.getByText(/data status:/i)).toBeInTheDocument();
  });

  it('can append the meaning inline for banners and captions', () => {
    render(<StatusLabel provenance="planned" withDescription />);
    expect(screen.getByText(new RegExp(PROVENANCE.planned.description, 'i'))).toBeVisible();
  });
});

describe('StatusLegend', () => {
  it('documents all five, so a label can always be looked up', () => {
    render(<StatusLegend />);
    for (const provenance of PROVENANCE_ORDER) {
      expect(screen.getByText(PROVENANCE[provenance].label)).toBeVisible();
      expect(screen.getByText(PROVENANCE[provenance].description)).toBeVisible();
    }
  });
});

/**
 * Vocabulary the product does not use.
 *
 * Each is banned for a specific reason rather than as a style preference: LIVE and
 * REAL claim more than the API can support, DEMO and MOCK invite a fabricated
 * result to be read as a genuine one, and BETA and COMING SOON are marketing states
 * that say nothing about whether a number can be trusted.
 */
describe('banned vocabulary', () => {
  const BANNED = ['LIVE', 'REAL', 'DEMO', 'MOCK', 'BETA', 'COMING SOON'];

  it('appears in no status label', () => {
    const words = PROVENANCE_ORDER.map((provenance) => PROVENANCE[provenance].label.toUpperCase());
    for (const banned of BANNED) {
      expect(words).not.toContain(banned);
    }
  });

  it('appears in no status description', () => {
    for (const provenance of PROVENANCE_ORDER) {
      const description = PROVENANCE[provenance].description.toUpperCase();
      for (const banned of BANNED) {
        expect(description).not.toMatch(new RegExp(`\\b${banned}\\b`));
      }
    }
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NAV_ITEMS } from '../components/layout/nav';
import { PROVENANCE } from '../components/provenance/provenance';
import { renderApp, stubHealthyApi } from '../../tests/render';

/**
 * Route coverage and shell behaviour.
 *
 * The first test is the one that matters most in Phase 2: every path advertised in
 * the navigation must resolve to a page with an `<h1>`. A nav entry pointing at a
 * path the router does not know renders the catch-all, which looks like a working
 * link until someone clicks it.
 */
describe('routing', () => {
  beforeEach(() => {
    stubHealthyApi();
  });

  it.each(NAV_ITEMS.map((item) => [item.to, item.label] as const))(
    'renders a page with one h1 at %s',
    async (path) => {
      renderApp(path);
      const headings = await screen.findAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toBeInTheDocument();
      expect(headings[0]?.textContent?.trim()).not.toBe('');
    }
  );

  it('renders the not-found page for an unknown path, not a blank screen', async () => {
    renderApp('/this-does-not-exist');
    expect(await screen.findByRole('heading', { level: 1, name: /page not found/i })).toBeVisible();
    // The way out is part of the page, not left to the browser's back button.
    expect(screen.getByRole('link', { name: /go to the overview/i })).toBeVisible();
  });

  it('nests batch scoring under the research area', async () => {
    renderApp('/research/batch');
    expect(await screen.findByRole('heading', { level: 1, name: /batch scoring/i })).toBeVisible();
    // The parent route renders an outlet, not its own heading, so there is still one h1.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets the document title per route', async () => {
    renderApp('/learn');
    await waitFor(() => {
      expect(document.title).toBe('Learn · EthioCKD');
    });
  });

  it('provides a skip link as the first focusable element', async () => {
    renderApp('/');
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveFocus();
  });

  it('exposes a named main landmark for the skip link to reach', async () => {
    renderApp('/');
    const main = await screen.findByRole('main');
    expect(main).toHaveAttribute('id', 'main');
  });
});

/**
 * The two simulation routes and the planned one carry their label permanently.
 *
 * Asserted through the banner's accessible name rather than by looking for text, so
 * the test fails if the label stops being announced — a visually present, silently
 * announced label is the failure mode that matters here.
 */
describe('permanent provenance labels', () => {
  beforeEach(() => {
    stubHealthyApi();
  });

  it.each([
    ['/multimodal', 'simulation'],
    ['/federated', 'simulation'],
    ['/facilities', 'planned'],
  ] as const)('labels %s as %s and offers no way to dismiss it', async (path, provenance) => {
    renderApp(path);
    const label = PROVENANCE[provenance].label;
    const banner = await screen.findByRole('note', { name: `${label} notice` });
    expect(banner).toBeVisible();
    expect(banner.querySelectorAll('button')).toHaveLength(0);
  });

  it('does not label the assessment or the overview', async () => {
    renderApp('/assessment');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('note', { name: /notice$/ })).toBeNull();
  });
});

/**
 * Result pages without a prediction.
 *
 * This is permanent behaviour, not a Phase 2 placeholder: the prediction lives in
 * memory only, so a direct visit or a reload legitimately has nothing to show.
 */
describe('pages that need a prediction', () => {
  beforeEach(() => {
    stubHealthyApi();
  });

  it.each([
    ['/results', /no result to show yet/i],
    ['/explainability', /nothing to explain yet/i],
  ] as const)('explains the empty case at %s and offers the assessment', async (path, message) => {
    renderApp(path);
    expect(await screen.findByText(message)).toBeVisible();
    const links = screen.getAllByRole('link', { name: /start an assessment/i });
    expect(links.length).toBeGreaterThan(0);
  });

  it('never presents an empty result as an alert', async () => {
    renderApp('/results');
    await screen.findByText(/no result to show yet/i);
    // An absent prediction is not a failure, so nothing on the page may claim it is.
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NAV_ITEMS } from '../../src/components/layout/nav';
import { renderApp, stubHealthyApi } from '../render';

/**
 * T-A11Y-03 (zero axe violations per route), T-A11Y-13 (landmarks and headings) and
 * T-A11Y-14 (the skip link), over the real route table.
 *
 * Phase 2 sweeps the default state of every route. The loading, empty and error
 * passes the test plan also asks for arrive with the pages that have those states —
 * a skeleton that does not exist yet cannot be swept, and asserting over a
 * placeholder would report coverage this suite does not have.
 *
 * `axe` is not a substitute for the manual checklist in
 * `FRONTEND_ACCESSIBILITY_CHECKLIST.md`: it catches roughly the machine-checkable
 * third of WCAG. It is here because that third contains every regression that is
 * cheap to introduce — an unlabelled control, a broken `aria-describedby`, a heading
 * level skipped by an edit three components away.
 */

const PATHS: readonly string[] = [...new Set([...NAV_ITEMS.map((item) => item.to), '/research/batch'])];

describe('T-A11Y-03 · axe over every route', () => {
  beforeEach(() => {
    stubHealthyApi();
  });

  it.each(PATHS)('has no axe violations at %s', async (path) => {
    const { container } = renderApp(path);
    // Wait for the shell's health query to settle first: asserting mid-flight would
    // scan a tree that is still a loading state and call it the page.
    await screen.findByRole('heading', { level: 1 });
    await expect(axe(container)).resolves.toHaveNoViolations();
  }, 30_000);

  it('has no axe violations on the not-found page', async () => {
    const { container } = renderApp('/no-such-page');
    await screen.findByRole('heading', { level: 1 });
    await expect(axe(container)).resolves.toHaveNoViolations();
  }, 30_000);
});

/**
 * Landmarks and heading order.
 *
 * A screen-reader user navigates by landmark and by heading before reading anything,
 * so a page with two `main`s or a jump from `h1` to `h3` is disorienting in a way
 * that is completely invisible on screen.
 */
describe('T-A11Y-13 · landmarks and headings', () => {
  beforeEach(() => {
    stubHealthyApi();
  });

  it.each(PATHS)('has one main, one page banner and one contentinfo at %s', async (path) => {
    renderApp(path);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);

    // Testing Library's role query maps every `<header>` to `banner`. The HTML-AAM
    // scoping rule — a `header` inside `main` is generic, not a landmark — is
    // implemented by axe, which reports no violation for the `PageHeader` inside
    // `main`, but not by the query. So the invariant is stated as "one header
    // outside main" rather than by a raw role count.
    const banners = screen.getAllByRole('banner').filter((node) => node.closest('main') === null);
    expect(banners).toHaveLength(1);
  });

  it.each(PATHS)('skips no heading level inside main at %s', async (path) => {
    renderApp(path);
    await screen.findByRole('heading', { level: 1 });

    // Scoped to `main` deliberately. The sidebar's group labels are `h2`s that
    // precede the page `h1` in document order, and they are landmark-scoped labels
    // rather than part of the page's outline — a document-order scan would report
    // them as a defect and there is nothing to fix. What a reader actually
    // navigates is the outline inside `main`.
    const main = screen.getByRole('main');
    const levels = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((node) =>
      Number(node.tagName[1])
    );
    expect(levels[0], 'the first heading inside main must be the h1').toBe(1);

    for (const [index, level] of levels.entries()) {
      const previous = levels[index - 1];
      if (previous === undefined) continue;
      // Going back up any number of levels is fine — that is a new section. Going
      // down more than one step at a time is the defect.
      expect(level - previous, `heading order broke at index ${index}`).toBeLessThanOrEqual(1);
    }
  });

  it('names every navigation landmark, because a page holds more than one', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    // Two unnamed `nav`s are indistinguishable in a landmark list.
    for (const nav of screen.getAllByRole('navigation')) expect(nav).toHaveAccessibleName();
  });
});

/**
 * The skip link and the focus move on navigation.
 *
 * With a twelve-item sidebar, reaching the content without a skip link costs
 * thirteen keystrokes on every page (WCAG 2.4.1). And in a single-page application
 * a route change does not move focus by itself: without the shell's effect, a
 * keyboard user who follows a link stays on the link they just left and the new page
 * is announced not at all.
 */
describe('T-A11Y-14 · skip link and focus on navigation', () => {
  beforeEach(() => {
    stubHealthyApi();
  });

  it('is the first thing the tab key reaches', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveFocus();
  });

  it('points at the main landmark, which is focusable but not tabbable', async () => {
    renderApp('/');
    const main = await screen.findByRole('main');
    const skip = screen.getByRole('link', { name: /skip to main content/i });

    expect(skip).toHaveAttribute('href', `#${main.id}`);
    // jsdom does not follow the fragment, so the target's focusability is what is
    // asserted; the jump itself is on the manual checklist.
    expect(main).toHaveAttribute('tabindex', '-1');
    main.focus();
    expect(main).toHaveFocus();
  });

  it('moves focus into the new page when the route changes', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    const user = userEvent.setup();

    const sidebar = screen.getByRole('navigation', { name: /sections/i });
    await user.click(within(sidebar).getByRole('link', { name: 'Learn' }));

    await screen.findByRole('heading', { level: 1, name: /learn/i });
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('does not steal focus on first render', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    // The browser's own initial focus is correct; overriding it would break
    // deep-linking straight into a control.
    expect(screen.getByRole('main')).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });
});

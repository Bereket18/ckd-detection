import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HEALTH_DEGRADED_FIXTURE } from '../fixtures/api';
import { renderApp, stubHealthyApi } from '../render';

/**
 * T-SHELL-01 · the persistent shell.
 *
 * The shell is the one piece of UI on every route, so a defect in it is a defect
 * everywhere — and it is the piece with no page of its own to test it. Two parts had
 * no coverage at all: the mobile drawer, which is the *only* way to navigate below
 * `lg`, and the health banner, which is the only thing that tells a user the service
 * cannot score an assessment.
 *
 * What jsdom can and cannot show here is worth stating, because the drawer is a
 * native `<dialog>`: `showModal` is unimplemented, so `Dialog` falls back to the
 * `open` attribute (its documented feature-detected path). The dialog is therefore
 * in the DOM and operable, but there is no top layer and no native focus trap to
 * observe. Focus containment and focus restoration are on the browser checklist for
 * exactly that reason; what is asserted here is everything else — that the drawer
 * opens, names itself, navigates, closes on selection, closes on the close control,
 * and does not leave the page in a state where nothing is reachable.
 */

async function openDrawer(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Open menu' }));
  return within(await screen.findByRole('dialog')).getByRole('navigation', { name: 'Sections' });
}

describe('T-SHELL-01 · the mobile drawer', () => {
  it('is the second navigation, and both list every section', async () => {
    // One `AppNav` serves the sidebar and the drawer so the two cannot drift. That
    // is a claim about the code; this is the assertion that makes it a guarantee.
    stubHealthyApi();
    const user = userEvent.setup();
    renderApp('/');

    const sidebar = screen.getByRole('navigation', { name: 'Sections' });
    const sidebarLinks = within(sidebar)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    const drawer = await openDrawer(user);
    const drawerLinks = within(drawer)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(drawerLinks).toEqual(sidebarLinks);
    expect(drawerLinks.length).toBeGreaterThanOrEqual(12);
  });

  it('names itself and says what it is for', async () => {
    stubHealthyApi();
    const user = userEvent.setup();
    renderApp('/');

    await openDrawer(user);
    const dialog = screen.getByRole('dialog');
    // `aria-labelledby` and `aria-describedby`, not a bare unnamed dialog: a screen
    // reader announcing "dialog" and nothing else is the failure mode.
    expect(dialog).toHaveAccessibleName('Sections');
    expect(dialog).toHaveAccessibleDescription('Choose where to go.');
  });

  it('reports its own state on the trigger', async () => {
    stubHealthyApi();
    const user = userEvent.setup();
    renderApp('/');

    const trigger = screen.getByRole('button', { name: 'Open menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('navigates and closes itself, so the next page is not behind a modal', async () => {
    stubHealthyApi();
    const user = userEvent.setup();
    const { router } = renderApp('/');

    const drawer = await openDrawer(user);
    await user.click(within(drawer).getByRole('link', { name: /federated/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/federated'));
    // The drawer closing is not cosmetic: it is a modal, and a modal left open over
    // the page the user just navigated to hides that page from assistive technology.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes on the close control without navigating', async () => {
    stubHealthyApi();
    const user = userEvent.setup();
    const { router } = renderApp('/learn');

    await openDrawer(user);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe('/learn');
  });

  it('offers the assessment from inside the drawer', async () => {
    // The header's *Start assessment* button is hidden below `sm`, so on the
    // narrowest supported screen the drawer copy is the only route to it.
    stubHealthyApi();
    const user = userEvent.setup();
    renderApp('/');

    await openDrawer(user);
    const links = within(screen.getByRole('dialog')).getAllByRole('link', {
      name: /start assessment/i,
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/assessment');
  });
});

describe('T-SHELL-02 · the health banner', () => {
  it('says nothing while the first probe is in flight, and nothing when healthy', async () => {
    // A banner that flashes on every load is a banner users learn to ignore.
    stubHealthyApi();
    renderApp('/');

    expect(screen.queryByRole('status')).toBeNull();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('distinguishes a degraded service from an unreachable one', async () => {
    // The distinction exists because a degraded probe arrives with HTTP **200**:
    // the request succeeded and the model still cannot score anyone. Collapsing the
    // two would tell a user to check their connection when the connection is fine.
    stubDegradedApi();
    renderApp('/');

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/temporarily unavailable/i);
    expect(banner).toHaveTextContent(/everything else on this site still works/i);
  });

  it('never shows the backend `detail`, which carries a server path', async () => {
    stubDegradedApi();
    renderApp('/');

    await screen.findByRole('status');
    // The fixture's `detail` is a real-shaped absolute path. If it ever reaches the
    // DOM, this fails on the substring rather than on the whole string, so a
    // partially-rendered leak is caught too.
    expect(HEALTH_DEGRADED_FIXTURE.detail).toContain('saved_models');
    expect(document.body.textContent).not.toContain('saved_models');
    expect(document.body.textContent).not.toContain('ArtifactLoadError');
  });

  it('offers a retry rather than requiring a reload', async () => {
    stubDegradedApi();
    renderApp('/');

    await screen.findByRole('status');
    expect(
      within(screen.getByRole('status')).getByRole('button', { name: /check again/i })
    ).toBeEnabled();
  });

  it('leaves the rest of the site usable while the service is down', async () => {
    // The educational pages need no backend. Blocking the whole application on a
    // health probe would take away the part that still works.
    stubDegradedApi();
    renderApp('/learn');

    await screen.findByRole('status');
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  });
});

/** A `/health` that answers 200 with `status: "degraded"` — the real shape. */
function stubDegradedApi(): void {
  const fetchMock = stubHealthyApi();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve(url.includes('/health') ? HEALTH_DEGRADED_FIXTURE : { detail: 'Not Found' }),
      text: () => Promise.resolve(JSON.stringify(HEALTH_DEGRADED_FIXTURE)),
    } as unknown as Response);
  });
}

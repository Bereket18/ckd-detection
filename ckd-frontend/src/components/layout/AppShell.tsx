import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Container } from '../ui/Container';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { AppNav } from './AppNav';
import { HealthBanner } from './HealthBanner';
import { SkipLink } from './SkipLink';

/**
 * The application shell: everything that persists across routes.
 *
 * Mobile-first by construction, not by media query afterthought. The single-column
 * layout is the base case and the sidebar is added at `lg`; at 320 px there is no
 * sidebar to hide, no horizontal scroll, and no layout that was designed for 1440 px
 * and then squeezed.
 *
 * The effect below moves focus to `<main>` on each route change. Without it a
 * keyboard or screen-reader user who follows a link stays focused on the link they
 * just left, and the new page is silent — the most common accessibility failure in
 * a single-page application. It is skipped on first render, where the browser's own
 * initial focus is correct.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <SkipLink />
      <AppHeader />
      <HealthBanner />

      <div className="flex-1">
        <Container width="wide" className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden no-print lg:block">
            <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto py-8 pe-2">
              <AppNav />
            </div>
          </aside>

          {/*
            `tabIndex={-1}` makes the landmark programmatically focusable for the
            route-change effect without adding it to the tab order.
          */}
          <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 py-8 lg:py-10">
            <Outlet />
          </main>
        </Container>
      </div>

      <AppFooter />
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Menu } from 'lucide-react';
import { buttonClasses } from '../ui/styles';
import { Container } from '../ui/Container';
import { Dialog } from '../ui/Dialog';
import { IconButton } from '../ui/IconButton';
import { AppNav } from './AppNav';

/**
 * The application header.
 *
 * Sticky, because the primary action — starting or resuming an assessment — should
 * not require scrolling back up a long education page.
 *
 * Below `lg` the navigation moves into a modal drawer rather than a hamburger
 * pop-over: the drawer is a native `<dialog>`, so it gets a focus trap, Escape, and
 * focus restored to the menu button for free. Those three are what phone
 * navigations usually miss.
 *
 * The *Start assessment* control is a `<Link>` wearing the button recipe, not a
 * `<button>` with an `onClick` navigation. It is a navigation, so it must be
 * middle-clickable, openable in a new tab, and announced as a link.
 */
export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 no-print backdrop-blur-sm">
      <Container width="wide" className="flex min-h-16 items-center justify-between gap-3 py-2">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md py-1 text-ink"
          aria-label="EthioCKD — home"
        >
          <HeartPulse aria-hidden className="size-6 shrink-0 text-accent" />
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">EthioCKD</span>
            <span className="hidden text-xs text-ink-muted sm:block">
              Explainable CKD risk screening
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/assessment" className={buttonClasses('primary', 'sm', 'hidden sm:inline-flex')}>
            Start assessment
          </Link>
          <IconButton
            label="Open menu"
            variant="secondary"
            onClick={() => setMenuOpen(true)}
            className="lg:hidden"
            aria-expanded={menuOpen}
            icon={<Menu aria-hidden className="size-5" />}
          />
        </div>
      </Container>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Sections"
        description="Choose where to go."
        size="sm"
      >
        <AppNav withSummaries onNavigate={() => setMenuOpen(false)} />
        <Link
          to="/assessment"
          onClick={() => setMenuOpen(false)}
          className={buttonClasses('primary', 'md', 'mt-6 w-full sm:hidden')}
        >
          Start assessment
        </Link>
      </Dialog>
    </header>
  );
}

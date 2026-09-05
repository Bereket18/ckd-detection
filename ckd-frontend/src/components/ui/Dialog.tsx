import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './IconButton';

type DialogSize = 'sm' | 'md' | 'lg';

const SIZES: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name. A string, because it becomes `aria-labelledby`. */
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  className?: string;
}

/**
 * Open and close through the platform when it offers the methods, and through the
 * `open` attribute when it does not.
 *
 * Both directions are feature-detected, not just one. `showModal` and `close` are
 * absent together in the same environments — jsdom, older embedded webviews — and
 * detecting only the opening half means a component that mounts fine and then
 * throws inside an effect on the way out, which React reports as an unhandled
 * error rather than as a missing DOM feature.
 */
function openDialog(element: HTMLDialogElement): void {
  if (element.open) return;
  if (typeof element.showModal === 'function') element.showModal();
  else element.setAttribute('open', '');
}

function closeDialog(element: HTMLDialogElement): void {
  if (!element.open) return;
  if (typeof element.close === 'function') element.close();
  else element.removeAttribute('open');
}

/**
 * A modal built on the native `<dialog>` element.
 *
 * `showModal()` brings four behaviours that hand-rolled modals routinely get wrong:
 * the top layer (so no `z-index` arithmetic), a real focus trap, focus restored to
 * the trigger on close, and everything behind it removed from the accessibility
 * tree. Escape is native too — but it is intercepted via `onCancel` and routed
 * through `onClose`, because otherwise the element would close itself while the
 * React state that owns `open` still said it was open.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const titleId = `dialog-title-${uid}`;
  const descriptionId = `dialog-description-${uid}`;

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    if (open) {
      openDialog(element);
      // Unmounting while open must not leave a top-layer element behind.
      return () => closeDialog(element);
    }

    closeDialog(element);
    return undefined;
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click that lands on the element itself is a click on the backdrop:
        // the content is inside a child, so it can never be the target.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-0 text-ink',
        'shadow-overlay backdrop:bg-ink/40',
        SIZES[size],
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description !== undefined && (
            <p id={descriptionId} className="text-sm text-ink-muted">
              {description}
            </p>
          )}
        </div>
        <IconButton
          label="Close"
          size="sm"
          onClick={onClose}
          className="-me-1.5 -mt-1"
          icon={<X aria-hidden className="size-5" />}
        />
      </div>

      {children !== undefined && <div className="px-5 py-4">{children}</div>}

      {footer !== undefined && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}

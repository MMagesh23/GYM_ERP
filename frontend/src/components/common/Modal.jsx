import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// FIX (scroll-lock bug): the lock was set/cleared per-modal instance. With a
// modal opened on top of another (e.g. RecordPaymentModal launched from the
// MemberProfilePage flow), closing the INNER one ran its cleanup and reset
// body overflow to '' while the outer modal was still open — the page then
// scrolled behind it. Counting open modals means the lock only lifts when the
// last one closes. Module scope on purpose: shared across all instances.
let openModalCount = 0;

const lockBodyScroll = () => {
  openModalCount += 1;
  if (openModalCount === 1) {
    // Compensate for the disappearing scrollbar so the page behind doesn't
    // visibly shift sideways when the lock engages.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.dataset.prevPaddingRight = document.body.style.paddingRight || '';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = 'hidden';
  }
};

const unlockBodyScroll = () => {
  openModalCount = Math.max(openModalCount - 1, 0);
  if (openModalCount === 0) {
    document.body.style.overflow = '';
    document.body.style.paddingRight = document.body.dataset.prevPaddingRight || '';
    delete document.body.dataset.prevPaddingRight;
  }
};

const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  const bodyRef = useRef(null);
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    lockBodyScroll();

    // Return focus to whatever opened the modal on close, instead of dumping
    // keyboard users back at the top of the document.
    previouslyFocused.current = document.activeElement;
    const focusTimer = setTimeout(() => panelRef.current?.focus(), 30);

    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
      clearTimeout(focusTimer);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) setScrolled(false);
  }, [open]);

  if (!open) return null;

  const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  const handleBodyScroll = () => {
    if (!bodyRef.current) return;
    setScrolled(bodyRef.current.scrollTop > 4);
  };

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm animate-fade-in sm:items-center sm:px-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`glass-modal glass-isolate flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl outline-none animate-slide-in-right sm:max-h-[85vh] sm:animate-scale-in sm:rounded-2xl ${sizes[size]}`}
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-gray-300/60 dark:bg-white/20" />
        </div>

        <div
          className={`flex shrink-0 items-center justify-between border-b border-white/30 px-5 py-4 transition-shadow dark:border-white/10 ${
            scrolled ? 'shadow-[0_2px_10px_-4px_rgba(31,41,55,0.25)]' : ''
          }`}
        >
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/40 hover:text-gray-600 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div
          ref={bodyRef}
          onScroll={handleBodyScroll}
          className="overflow-y-auto overscroll-contain px-5 py-4"
        >
          {children}
        </div>
      </div>
    </div>
  );

  // FIX (critical): `backdrop-filter` makes an element a containing block for
  // `position: fixed` descendants. Several pages render a Modal *inside* a
  // card wrapper (e.g. ExpiringMembershipsSection renders the WhatsApp modal
  // inside its section div) — once that wrapper became a glass surface, the
  // modal's `fixed inset-0` resolved against the CARD, not the viewport, so
  // it rendered clipped inside the card instead of full-screen. Portaling to
  // <body> makes the modal immune to whatever ancestors it happens to sit
  // under, now or later. No API change for any caller.
  return createPortal(overlay, document.body);
};

export default Modal;

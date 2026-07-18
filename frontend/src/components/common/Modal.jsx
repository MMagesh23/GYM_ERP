import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  const bodyRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in sm:items-center sm:px-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-popover animate-slide-in-right dark:bg-gray-900 sm:max-h-[85vh] sm:animate-scale-in sm:rounded-2xl ${sizes[size]}`}
      >
        {/* Mobile drag handle, purely visual */}
        <div className="flex shrink-0 justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        <div
          className={`flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 transition-shadow dark:border-gray-800 ${
            scrolled ? 'shadow-[0_1px_0_0_rgba(0,0,0,0.06)]' : ''
          }`}
        >
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div ref={bodyRef} onScroll={handleBodyScroll} className="overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
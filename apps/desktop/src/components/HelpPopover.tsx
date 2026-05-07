import { useState, useRef, useEffect, useCallback } from "react";
import { CircleHelp } from "lucide-react";

interface HelpPopoverProps {
  children: React.ReactNode;
}

export function HelpPopover({ children }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      // Ignore clicks on scrollbars
      const target = e.target as HTMLElement;
      if (target === document.documentElement || target === document.body) return;
      if (ref.current && !ref.current.contains(target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen((prev) => !prev);
    // After opening, adjust position if overflowing
    requestAnimationFrame(() => {
      if (!popoverRef.current || !ref.current) return;
      const popRect = popoverRef.current.getBoundingClientRect();
      const containerRect = ref.current.getBoundingClientRect();
      if (popRect.right > window.innerWidth - 8) {
        // Flip to left
        popoverRef.current.style.left = "auto";
        popoverRef.current.style.right = `${containerRect.width + 4}px`;
      }
      if (popRect.bottom > window.innerHeight - 8) {
        popoverRef.current.style.top = "auto";
        popoverRef.current.style.bottom = "0";
        popoverRef.current.style.transform = "none";
      }
    });
  }, []);

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="text-text-quaternary/50 hover:text-text-quaternary transition-colors"
      >
        <CircleHelp size={13} />
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 left-5 top-1/2 -translate-y-1/2 w-64 bg-panel border border-border rounded-lg shadow-xl p-3 text-[0.8rem] text-text-secondary leading-relaxed"
        >
          {children}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { CircleHelp } from "lucide-react";

interface HelpPopoverProps {
  children: React.ReactNode;
}

export function HelpPopover({ children }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-text-quaternary/50 hover:text-text-quaternary transition-colors"
      >
        <CircleHelp size={13} />
      </button>
      {open && (
        <div className="absolute z-50 left-5 top-1/2 -translate-y-1/2 w-64 bg-panel border border-border rounded-lg shadow-xl p-3 text-[0.8rem] text-text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

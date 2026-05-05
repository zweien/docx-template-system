import { useEffect, useRef } from "react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = "确认", danger = false, onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-surface border border-border rounded-lg shadow-xl w-[340px] p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-text font-medium text-[0.933rem]">{title}</h3>
        <p className="text-text-secondary text-[0.867rem] leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 bg-surface border border-border text-text-secondary rounded-md hover:bg-surface-hover text-[0.8rem] transition-colors"
          >
            取消
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded-md text-[0.8rem] font-medium transition-colors ${
              danger
                ? "bg-danger text-white hover:brightness-110"
                : "bg-brand text-white hover:bg-brand-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

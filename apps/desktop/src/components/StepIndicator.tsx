interface Props {
  steps: string[];
  current: number;
  onChange?: (step: number) => void;
}

export function StepIndicator({ steps, current, onChange }: Props) {
  return (
    <div className="step-indicator flex items-center gap-0 mb-8">
      {steps.map((step, idx) => {
        const isPast = idx < current;
        const isCurrent = idx === current;
        const clickable = isPast && onChange;

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => clickable && onChange(idx)}
              disabled={!clickable}
              className="flex items-center gap-2.5 group"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.733rem] font-medium shrink-0 transition-all duration-150 ${
                  isCurrent
                    ? "bg-brand text-white"
                    : isPast
                    ? "bg-success text-white cursor-pointer"
                    : "bg-surface border border-border text-text-quaternary"
                }`}
              >
                {isPast ? "✓" : idx + 1}
              </div>
              <span className={`text-[0.8rem] leading-tight ${
                isCurrent
                  ? "text-brand-accent font-medium"
                  : isPast
                  ? "text-success font-medium"
                  : "text-text-quaternary"
              }`}>
                {step}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div className={`step-connector flex-1 h-px mx-3 transition-colors duration-300 ${
                idx < current ? "bg-success/30" : "bg-border"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

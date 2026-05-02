interface Props {
  steps: string[];
  current: number;
  onChange?: (step: number) => void;
}

export function StepIndicator({ steps, current, onChange }: Props) {
  return (
    <div className="flex gap-2 mb-6">
      {steps.map((step, idx) => {
        const isPast = idx < current;
        const isCurrent = idx === current;
        const clickable = isPast && onChange;
        return (
          <div
            key={step}
            onClick={() => clickable && onChange(idx)}
            className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
              isCurrent
                ? "border-blue-500 bg-blue-50"
                : isPast
                ? "border-green-500 bg-green-50 cursor-pointer hover:bg-green-100"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="text-xs text-gray-500">步骤 {idx + 1}/{steps.length}</div>
            <div className={`font-bold mt-0.5 ${isPast ? "text-green-700" : ""}`}>{step}</div>
          </div>
        );
      })}
    </div>
  );
}

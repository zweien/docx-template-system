interface Props {
  steps: string[];
  current: number;
}

export function StepIndicator({ steps, current }: Props) {
  return (
    <div className="flex gap-2 mb-6">
      {steps.map((step, idx) => (
        <div
          key={step}
          className={`flex-1 p-4 rounded-lg border-2 ${
            idx === current
              ? "border-blue-500 bg-blue-50"
              : idx < current
              ? "border-green-500 bg-green-50"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="text-xs text-gray-500">步骤 {idx + 1}/{steps.length}</div>
          <div className="font-bold mt-1">{step}</div>
        </div>
      ))}
    </div>
  );
}

import { useState } from "react";
import { StepIndicator } from "./StepIndicator";
import { ReportContent, BudgetConfig } from "../types";

interface Props {
  currentStep: number;
  onStepChange: (step: number) => void;
  addLog: (msg: string) => void;
}

const STEPS = ["导入 Excel", "选择配置", "生成报告"];

export function Wizard({ currentStep, onStepChange, addLog }: Props) {
  const [content, setContent] = useState<ReportContent | null>(null);

  return (
    <main className="flex-1 p-6 overflow-auto">
      <StepIndicator steps={STEPS} current={currentStep} />
      <div className="text-gray-500">步骤 {currentStep + 1}: {STEPS[currentStep]}</div>
    </main>
  );
}

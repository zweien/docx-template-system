import { useState } from "react";
import { StepIndicator } from "./StepIndicator";
import { ExcelImport } from "./ExcelImport";
import { ReportContent, BudgetConfig } from "../types";

interface Props {
  currentStep: number;
  onStepChange: (step: number) => void;
  addLog: (msg: string) => void;
}

const STEPS = ["导入 Excel", "选择配置", "生成报告"];

export function Wizard({ currentStep, onStepChange, addLog }: Props) {
  const [content, setContent] = useState<ReportContent | null>(null);
  const [config, setConfig] = useState<BudgetConfig | null>(null);
  const [templatePath, setTemplatePath] = useState("");

  return (
    <main className="flex-1 p-6 overflow-auto">
      <StepIndicator steps={STEPS} current={currentStep} />

      {currentStep === 0 && (
        <ExcelImport
          onParsed={(c) => {
            setContent(c);
            onStepChange(1);
          }}
          addLog={addLog}
        />
      )}
      {currentStep === 1 && content && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">选择配置与模板</h2>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p>解析完成：{content.sections?.length || 0} 个章节</p>
            <p className="text-sm text-gray-600 mt-2">
              此步骤后续将实现配置选择和模板选择功能
            </p>
          </div>
          <button
            onClick={() => onStepChange(2)}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            下一步：生成报告
          </button>
        </div>
      )}
      {currentStep === 2 && content && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">生成报告</h2>
          <p className="text-gray-600">
            此步骤后续将实现报告生成功能（调用 /api/render）
          </p>
        </div>
      )}
    </main>
  );
}

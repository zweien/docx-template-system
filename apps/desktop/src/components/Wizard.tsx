import { useAppStore } from "../stores/app-store";
import { StepIndicator } from "./StepIndicator";
import { StepTemplateSelect } from "./wizard/StepTemplateSelect";
import { StepConfigure } from "./wizard/StepConfigure";
import { StepGenerate } from "./wizard/StepGenerate";
import { ExcelImport } from "./ExcelImport";

const STEPS = ["选择模板", "导入 Excel", "配置预览", "生成报告"];

export function Wizard() {
  const { wizardStep, setWizardStep, addLog, setExcelContent } = useAppStore();

  const handleStepClick = (step: number) => {
    if (step < wizardStep && step <= 1) {
      setExcelContent(null);
    }
    setWizardStep(step);
  };

  return (
    <main className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <StepIndicator steps={STEPS} current={wizardStep} onChange={handleStepClick} />

        {wizardStep === 0 && <StepTemplateSelect />}
        {wizardStep === 1 && (
          <ExcelImport
            onParsed={(c) => {
              setExcelContent(c);
              addLog(`Excel 解析完成: ${c.sections?.length || 0} 个章节`);
              setWizardStep(2);
            }}
            addLog={addLog}
          />
        )}
        {wizardStep === 2 && <StepConfigure />}
        {wizardStep === 3 && <StepGenerate />}
      </div>
    </main>
  );
}

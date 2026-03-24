"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  StepIndicator,
  Step1SelectData,
  Step2FieldMapping,
  Step3Settings,
  Step4Result,
} from "@/components/batch";
import type {
  FieldMapping,
  Settings,
  BatchGenerationResult,
} from "@/types/batch-generation";

interface BatchGenerationWizardProps {
  templateId: string;
}

const STEPS = {
  SELECT_DATA: 1,
  FIELD_MAPPING: 2,
  SETTINGS: 3,
  RESULT: 4,
};

const DEFAULT_SETTINGS: Settings = {
  fileNamePattern: "文档_{{_index}}",
  outputMethod: "DOWNLOAD",
};

export function BatchGenerationWizard({
  templateId,
}: BatchGenerationWizardProps) {
  const router = useRouter();

  // 步骤状态
  const [step, setStep] = useState(STEPS.SELECT_DATA);

  // Step 1: 数据选择
  const [dataTableId, setDataTableId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Step 2: 字段映射
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});

  // Step 3: 设置
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Step 4: 结果
  const [result, setResult] = useState<BatchGenerationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 获取可用变量列表（从字段映射中提取数据字段）
  const availableVariables = Object.values(fieldMapping)
    .filter((v): v is string => v !== null);

  // 步骤导航
  const handleNext = useCallback(() => {
    if (step < STEPS.RESULT) {
      setStep(step + 1);
    }
  }, [step]);

  const handlePrev = useCallback(() => {
    if (step > STEPS.SELECT_DATA) {
      setStep(step - 1);
    }
  }, [step]);

  // 执行批量生成
  const handleGenerate = useCallback(async () => {
    if (!dataTableId || selectedRecordIds.length === 0) {
      toast.error("请选择数据表和记录");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/templates/${templateId}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataTableId,
          recordIds: selectedRecordIds,
          fieldMapping,
          fileNamePattern: settings.fileNamePattern,
          outputMethod: settings.outputMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "批量生成失败");
      }

      setResult(data);
      setStep(STEPS.RESULT);
      toast.success(`成功生成 ${data.generatedRecords?.length || 0} 个文档`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "批量生成失败";
      setSubmitError(message);
      setStep(STEPS.RESULT);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [dataTableId, selectedRecordIds, fieldMapping, settings, templateId]);

  // 关闭向导
  const handleClose = useCallback(() => {
    router.push(`/templates/${templateId}`);
  }, [router, templateId]);

  // 根据当前步骤渲染内容
  const renderStep = () => {
    switch (step) {
      case STEPS.SELECT_DATA:
        return (
          <Step1SelectData
            templateId={templateId}
            selectedTableId={dataTableId}
            selectedRecordIds={selectedRecordIds}
            onTableSelect={setDataTableId}
            onRecordsSelect={setSelectedRecordIds}
            onNext={handleNext}
          />
        );

      case STEPS.FIELD_MAPPING:
        if (!dataTableId) {
          return <div className="text-center py-8">请先选择数据表</div>;
        }
        return (
          <Step2FieldMapping
            templateId={templateId}
            dataTableId={dataTableId}
            fieldMapping={fieldMapping}
            onMappingChange={setFieldMapping}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        );

      case STEPS.SETTINGS:
        return (
          <Step3Settings
            settings={settings}
            onSettingsChange={setSettings}
            availableVariables={availableVariables}
            onPrev={handlePrev}
            onNext={handleGenerate}
          />
        );

      case STEPS.RESULT:
        return (
          <Step4Result
            result={result}
            isLoading={isSubmitting}
            error={submitError}
            onClose={handleClose}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* 步骤指示器 */}
      {step < STEPS.RESULT && (
        <StepIndicator current={step} total={4} />
      )}

      {/* 步骤内容 */}
      <div className="bg-card rounded-lg border p-6">
        {renderStep()}
      </div>
    </div>
  );
}

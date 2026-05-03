"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileJson,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  validateBudgetExcel,
  fetchBudgetConfig,
  listBudgetConfigs,
  type ValidationResult,
} from "@/lib/budget-report-client";
import { ValidationDetailView } from "./validation-detail-view";

export function BudgetDataValidationPanel() {
  const [configList, setConfigList] = useState<
    { id: string; name: string }[]
  >([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [selectedConfigId, setSelectedConfigId] = useState("default.json");
  const [configFile, setConfigFile] = useState<File | null>(null);
  const [customConfig, setCustomConfig] = useState<Record<
    string,
    unknown
  > | null>(null);

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const configs = await listBudgetConfigs();
        if (!cancelled) setConfigList(configs);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        setExcelFile(file);
        setValidationResult(null);
        setValidationError(null);
      }
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setExcelFile(file);
        setValidationResult(null);
        setValidationError(null);
      }
    },
    []
  );

  const handleValidate = useCallback(async () => {
    if (!excelFile) return;
    try {
      setValidating(true);
      setValidationError(null);
      setValidationResult(null);

      const config =
        customConfig ?? (await fetchBudgetConfig(selectedConfigId));
      const result = await validateBudgetExcel(excelFile, config);
      setValidationResult(result);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "校验请求失败"
      );
    } finally {
      setValidating(false);
    }
  }, [excelFile, selectedConfigId, customConfig]);

  const canValidate = excelFile && !validating;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      {/* Left panel */}
      <div className="space-y-4">
        {/* Config selection */}
        <Card className="rounded-xl border border-border bg-card p-4 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)]">
          <CardContent className="p-0 space-y-3">
            <h3 className="text-sm font-medium">解析配置</h3>
            {configFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <FileJson className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium truncate">
                  {configFile.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setConfigFile(null);
                    setCustomConfig(null);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive ml-auto"
                >
                  移除
                </button>
              </div>
            ) : (
              <>
                {!configLoading && configList.length > 0 && (
                  <select
                    value={selectedConfigId}
                    onChange={(e) => {
                      setSelectedConfigId(e.target.value);
                      setCustomConfig(null);
                      setConfigFile(null);
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    {configList.map((cfg) => (
                      <option key={cfg.id} value={cfg.id}>
                        {cfg.name}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/30 px-3 py-2.5 cursor-pointer transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    导入 JSON 配置
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const json = JSON.parse(
                            reader.result as string
                          );
                          setConfigFile(f);
                          setCustomConfig(json);
                        } catch {
                          alert("无效的 JSON 文件");
                        }
                      };
                      reader.readAsText(f);
                    }}
                  />
                </label>
              </>
            )}
          </CardContent>
        </Card>

        {/* Excel upload */}
        <Card className="rounded-xl border border-border bg-card p-4 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)]">
          <CardContent className="p-0 space-y-3">
            <h3 className="text-sm font-medium">Excel 文件</h3>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
                validating && "pointer-events-none opacity-60"
              )}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={validating}
              />
              <Upload className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">
                拖放或点击选择 Excel
              </p>
            </div>
            {excelFile && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium truncate">
                  {excelFile.name}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {(excelFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validate button */}
        <Button
          onClick={handleValidate}
          disabled={!canValidate}
          className="w-full"
        >
          {validating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              正在校验...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              开始校验
            </>
          )}
        </Button>

        {validationError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">{validationError}</p>
          </div>
        )}
      </div>

      {/* Right panel: results */}
      <div>
        {!validationResult && !validationError ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-muted-foreground/15 text-center">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              选择配置和 Excel 文件后，点击"开始校验"
            </p>
          </div>
        ) : validationResult ? (
          <ValidationDetailView results={validationResult} />
        ) : null}
      </div>
    </div>
  );
}

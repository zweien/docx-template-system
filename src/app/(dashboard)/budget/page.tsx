"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Download,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "@/components/batch/step-indicator";
import { cn } from "@/lib/utils";
import {
  validateBudgetExcel,
  parseBudgetExcel,
  renderBudgetReport,
  fetchBudgetConfig,
  listBudgetConfigs,
  uploadBudgetTemplate,
  type ValidationResult,
  type ParseResult,
} from "@/lib/budget-report-client";

const STEP_LABELS = ["选择模板配置", "上传 Excel", "预览与生成"];

const DEFAULT_TEMPLATE = "budget_report.docx";

export default function BudgetWizardPage() {
  // Step state
  const [step, setStep] = useState(1);

  // Step 1: config selection
  const [configList, setConfigList] = useState<{ id: string; name: string }[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("default.json");
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Step 1: template & config file upload
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePath, setTemplatePath] = useState<string>(DEFAULT_TEMPLATE);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [configFile, setConfigFile] = useState<File | null>(null);
  const [customConfig, setCustomConfig] = useState<Record<string, unknown> | null>(null);

  // Step 2: Excel upload & validation
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Step 3: parse result & generation
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Session ID for report-engine
  const [sessionId] = useState(() => crypto.randomUUID());

  // Load config list on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setConfigLoading(true);
        setConfigError(null);
        const configs = await listBudgetConfigs();
        if (!cancelled) {
          setConfigList(configs);
          if (configs.length > 0 && !selectedConfigId) {
            setSelectedConfigId(configs[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setConfigError(err instanceof Error ? err.message : "加载配置列表失败");
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- File drop handlers ---
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
        setParseResult(null);
        setGenerateError(null);
      }
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setValidationResult(null);
      setValidationError(null);
      setParseResult(null);
      setGenerateError(null);
    }
  }, []);

  // --- Validate & parse flow (triggered when file changes) ---
  useEffect(() => {
    if (!excelFile || step !== 2) return;

    let cancelled = false;

    async function runValidationAndParse() {
      const file = excelFile;
      if (!file) return;

      try {
        setValidating(true);
        setValidationError(null);
        setValidationResult(null);
        setParseResult(null);

        // Load the selected config (custom upload or from list)
        const config = customConfig ?? await fetchBudgetConfig(selectedConfigId);

        // Validate
        const vResult = await validateBudgetExcel(file, config);
        if (cancelled) return;
        setValidationResult(vResult);

        if (!vResult.overall_pass && vResult.total_errors > 0) {
          // Validation failed with errors — stop
          return;
        }

        // Validation passed (or only warnings) — proceed to parse
        setParsing(true);
        const pResult = await parseBudgetExcel(file, config, sessionId);
        if (cancelled) return;
        setParseResult(pResult);

        if (pResult.success) {
          // Auto-advance to step 3
          setStep(3);
        }
      } catch (err) {
        if (!cancelled) {
          setValidationError(err instanceof Error ? err.message : "校验失败");
        }
      } finally {
        if (!cancelled) {
          setValidating(false);
          setParsing(false);
        }
      }
    }

    runValidationAndParse();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excelFile, step]);

  // --- Generate report ---
  const handleGenerate = useCallback(async () => {
    if (!parseResult?.content) return;

    try {
      setGenerating(true);
      setGenerateError(null);

      const blob = await renderBudgetReport(
        parseResult.content as unknown as Record<string, unknown>,
        templatePath,
        sessionId,
        "budget_report.docx",
      );

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "budget_report.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "生成报告失败");
    } finally {
      setGenerating(false);
    }
  }, [parseResult, sessionId]);

  // --- Step navigation ---
  const canGoNext = () => {
    if (step === 1) return true;
    if (step === 2) return parseResult?.success === true;
    return false;
  };

  const goNext = () => {
    if (canGoNext() && step < 3) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-[510] tracking-[-0.7px] text-foreground">
          预算报告生成
        </h1>
        <p className="text-sm text-muted-foreground">
          上传预算 Excel 数据，自动生成 Word 格式预算报告
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator current={step} total={3} labels={STEP_LABELS} />

      {/* Step 1: Select template & config */}
      {step === 1 && (
        <Card className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)]">
          <CardContent className="space-y-6 p-0">
            <div>
              <h2 className="text-lg font-[590] tracking-tight mb-1">选择模板和配置</h2>
              <p className="text-sm text-muted-foreground">
                上传报告模板与解析配置，或使用默认配置
              </p>
            </div>

            {/* Template upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">报告模板 (.docx)</label>
              {templateFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium truncate">{templateFile.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {(templateFile.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => { setTemplateFile(null); setTemplatePath(DEFAULT_TEMPLATE); }}
                    className="text-xs text-muted-foreground hover:text-destructive ml-2"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/30 px-4 py-4 cursor-pointer transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">点击上传模板文件</span>
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setTemplateUploading(true);
                      try {
                        const result = await uploadBudgetTemplate(f);
                        setTemplateFile(f);
                        setTemplatePath(result.path);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "上传模板失败");
                      } finally {
                        setTemplateUploading(false);
                      }
                    }}
                    disabled={templateUploading}
                  />
                  {templateUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </label>
              )}
              {!templateFile && (
                <p className="text-xs text-muted-foreground">不上传则使用默认模板</p>
              )}
            </div>

            {/* Config: upload or select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">解析配置 (.json)</label>
              {configFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium truncate">{configFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setConfigFile(null); setCustomConfig(null); }}
                    className="text-xs text-muted-foreground hover:text-destructive ml-auto"
                  >
                    移除
                  </button>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-3 rounded-lg border border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-muted/30 px-4 py-4 cursor-pointer transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">点击上传配置文件</span>
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
                            const json = JSON.parse(reader.result as string);
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
                  {!customConfig && !configLoading && configList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-muted-foreground">或选择已有配置：</p>
                      {configList.map((cfg) => (
                        <button
                          key={cfg.id}
                          type="button"
                          onClick={() => { setSelectedConfigId(cfg.id); setCustomConfig(null); setConfigFile(null); }}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors w-full",
                            selectedConfigId === cfg.id && !customConfig
                              ? "border-primary bg-primary/5"
                              : "border-border bg-muted/50 hover:bg-muted"
                          )}
                        >
                          <div
                            className={cn(
                              "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center",
                              selectedConfigId === cfg.id && !customConfig
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {selectedConfigId === cfg.id && !customConfig && (
                              <div className="h-1 w-1 rounded-full bg-primary-foreground" />
                            )}
                          </div>
                          <span className="text-sm">{cfg.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Resource links */}
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="/budget-templates/budget_report.docx"
                download
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Download className="h-4 w-4" />
                下载示例模板
              </a>
              <a
                href="/budget-configs/default.json"
                download
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Download className="h-4 w-4" />
                下载示例配置
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload Excel */}
      {step === 2 && (
        <Card className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)]">
          <CardContent className="space-y-6 p-0">
            <div>
              <h2 className="text-lg font-[590] tracking-tight mb-1">上传 Excel 文件</h2>
              <p className="text-sm text-muted-foreground">
                拖放或选择 .xlsx / .xls 文件，系统将自动校验并解析数据
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
                (validating || parsing) && "pointer-events-none opacity-60"
              )}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={validating || parsing}
              />
              <Upload className="h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                拖放 Excel 文件到此处，或点击选择文件
              </p>
              <p className="text-xs text-muted-foreground/60">支持 .xlsx 和 .xls 格式</p>
            </div>

            {/* Uploaded file info */}
            {excelFile && !validating && !parsing && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{excelFile.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {(excelFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            )}

            {/* Loading state */}
            {(validating || parsing) && (
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-primary">
                  {validating ? "正在校验 Excel 数据..." : "正在解析 Excel 数据..."}
                </span>
              </div>
            )}

            {/* Validation error */}
            {validationError && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">校验请求失败</p>
                  <p className="text-xs text-destructive/80 mt-1">{validationError}</p>
                </div>
              </div>
            )}

            {/* Validation results */}
            {validationResult && (
              <div className="space-y-3">
                {/* Overall status */}
                {validationResult.overall_pass ? (
                  <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">
                        校验通过
                      </p>
                      {validationResult.total_warnings > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          存在 {validationResult.total_warnings} 条警告，但不影响生成
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        校验未通过 ({validationResult.total_errors} 个错误)
                      </p>
                      {validationResult.total_warnings > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          另有 {validationResult.total_warnings} 条警告
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Missing sheets */}
                {validationResult.missing_sheets.length > 0 && (
                  <div className="rounded-lg border border-destructive/15 bg-destructive/5 px-4 py-3">
                    <p className="text-sm font-medium text-destructive mb-1">缺少工作表</p>
                    <ul className="text-xs text-destructive/80 space-y-0.5">
                      {validationResult.missing_sheets.map((s) => (
                        <li key={s}>- {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Per-sheet details */}
                {validationResult.sheets.map((sheet) => (
                  <div key={sheet.sheet_name} className="space-y-1">
                    <div className="flex items-center gap-2">
                      {sheet.found ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="text-sm font-medium">{sheet.sheet_name}</span>
                      {sheet.found && (
                        <span className="text-xs text-muted-foreground">
                          ({sheet.total_rows} 行, 填充率 {Math.round(sheet.fill_rate * 100)}%)
                        </span>
                      )}
                    </div>

                    {/* Missing columns */}
                    {sheet.missing_columns.length > 0 && (
                      <div className="ml-6 text-xs text-destructive">
                        缺少列: {sheet.missing_columns.join(", ")}
                      </div>
                    )}

                    {/* Extra columns */}
                    {sheet.extra_columns.length > 0 && (
                      <div className="ml-6 text-xs text-muted-foreground">
                        额外列: {sheet.extra_columns.join(", ")}
                      </div>
                    )}

                    {/* Warnings */}
                    {sheet.warnings.length > 0 && (
                      <ul className="ml-6 text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                        {sheet.warnings.map((w, i) => (
                          <li key={i}>
                            <Info className="h-3 w-3 inline mr-1" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Numeric violations */}
                    {sheet.numeric_violations.length > 0 && (
                      <div className="ml-6 text-xs text-destructive">
                        数值格式错误:
                        <ul className="ml-3 space-y-0.5">
                          {sheet.numeric_violations.slice(0, 5).map((v, i) => (
                            <li key={i}>
                              第 {v.row} 行, 列 &quot;{v.column}&quot;: &quot;{v.value}&quot;
                            </li>
                          ))}
                          {sheet.numeric_violations.length > 5 && (
                            <li>...还有 {sheet.numeric_violations.length - 5} 条</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {/* User can still proceed if only warnings */}
                {!validationResult.overall_pass && validationResult.total_errors === 0 && (
                  <Button
                    onClick={() => setStep(3)}
                    variant="outline"
                    className="w-full"
                  >
                    忽略警告，继续下一步
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview & generate */}
      {step === 3 && parseResult?.content && (
        <Card className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)]">
          <CardContent className="space-y-6 p-0">
            <div>
              <h2 className="text-lg font-[590] tracking-tight mb-1">预览与生成</h2>
              <p className="text-sm text-muted-foreground">
                确认解析结果后，点击生成按钮导出 Word 报告
              </p>
            </div>

            {/* Content overview */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{parseResult.content.title}</p>
                  <p className="text-xs text-muted-foreground">
                    共 {parseResult.content.sections.length} 个章节
                  </p>
                </div>
              </div>

              {/* Per-section summary */}
              {parseResult.content.sections.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      章节概览
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {parseResult.content.sections.map((section, idx) => {
                      const tables = section.blocks.filter((b) => b.type === "table").length;
                      const images = section.blocks.filter((b) => b.type === "image").length;
                      const texts = section.blocks.filter((b) => b.type === "text").length;
                      return (
                        <div key={section.id || idx} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="text-sm font-medium text-foreground min-w-[140px]">
                            {section.name}
                          </span>
                          <div className="flex gap-3 text-xs text-muted-foreground ml-auto">
                            {texts > 0 && <span>{texts} 段文本</span>}
                            {tables > 0 && <span>{tables} 个表格</span>}
                            {images > 0 && <span>{images} 张图片</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Extra context / summary data */}
              {parseResult.content.extra_context &&
                Object.keys(parseResult.content.extra_context).length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b border-border">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        摘要数据
                      </p>
                    </div>
                    <div className="divide-y divide-border">
                      {Object.entries(parseResult.content.extra_context).map(([key, value]) => (
                        <div key={key} className="px-4 py-2 flex items-center gap-3">
                          <span className="text-xs text-muted-foreground min-w-[120px]">{key}</span>
                          <span className="text-sm text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
                    解析警告 ({parseResult.warnings.length})
                  </p>
                  <ul className="text-xs text-amber-600/80 dark:text-amber-400/80 space-y-0.5">
                    {parseResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Generate error */}
              {generateError && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">生成失败</p>
                    <p className="text-xs text-destructive/80 mt-1">{generateError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full h-10"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在生成报告...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  生成报告并下载
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: parse failed state */}
      {step === 3 && parseResult && !parseResult.success && parseResult.error && (
        <Card className="rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03),0_12px_30px_rgb(0_0_0_/_0.18)]">
          <CardContent className="p-0">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">解析失败</p>
                <p className="text-xs text-destructive/80 mt-1">
                  {parseResult.error.code}: {parseResult.error.message}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={step === 1}
          size="sm"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          上一步
        </Button>

        {step < 3 && (
          <Button
            variant="outline"
            onClick={goNext}
            disabled={!canGoNext()}
            size="sm"
          >
            下一步
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

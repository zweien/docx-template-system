"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Image,
  Info,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { ValidationResult } from "@/lib/budget-report-client";
import { cn } from "@/lib/utils";

function fillRateColor(rate: number) {
  if (rate >= 0.9) return "bg-green-500";
  if (rate >= 0.7) return "bg-amber-500";
  return "bg-destructive";
}

function OverallStatusBanner({ results }: { results: ValidationResult }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        results.overall_pass
          ? "border-green-500/20 bg-green-500/5"
          : "border-destructive/20 bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-3">
        {results.overall_pass ? (
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium",
                results.overall_pass
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive"
              )}
            >
              {results.overall_pass ? "校验通过" : "校验未通过"}
            </span>
            {results.total_errors > 0 && (
              <Badge variant="destructive" className="text-xs">
                {results.total_errors} 个错误
              </Badge>
            )}
            {results.total_warnings > 0 && (
              <Badge variant="secondary" className="text-xs">
                {results.total_warnings} 个警告
              </Badge>
            )}
          </div>
          {results.config_title && (
            <p className="text-xs text-muted-foreground mt-0.5">
              配置: {results.config_title}
            </p>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        Excel 包含 {results.excel_sheets.length} 个工作表:{" "}
        {results.excel_sheets.join(", ")}
      </div>
      {results.missing_sheets.length > 0 && (
        <div className="text-xs text-destructive mt-1">
          缺失工作表: {results.missing_sheets.join(", ")}
        </div>
      )}
    </div>
  );
}

function SummarySheetCard({
  result,
}: {
  result: NonNullable<ValidationResult["summary"]>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-lg border",
          result.found ? "border-border" : "border-destructive/30"
        )}
      >
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            {result.found ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm font-medium">
              汇总: {result.sheet_name}
            </span>
            <Badge variant="secondary" className="text-xs">
              {result.mode}
            </Badge>
          </div>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            {!result.found ? (
              <p className="text-xs text-destructive">工作表不存在</p>
            ) : (
              <>
                {result.key_column_found != null && (
                  <div className="flex gap-4 text-xs">
                    <span
                      className={
                        result.key_column_found
                          ? "text-green-600"
                          : "text-destructive"
                      }
                    >
                      键列 {result.key_column_found ? "✓" : "✕"}
                    </span>
                    {result.value_column_found != null && (
                      <span
                        className={
                          result.value_column_found
                            ? "text-green-600"
                            : "text-destructive"
                        }
                      >
                        值列 {result.value_column_found ? "✓" : "✕"}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  成功映射:{" "}
                  <span className="font-mono font-medium">
                    {result.mapped_count}
                  </span>{" "}
                  个键值对
                </p>
                {result.missing_keys.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                      缺失值 ({result.missing_keys.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.missing_keys.slice(0, 20).map((k) => (
                        <Badge
                          key={k}
                          variant="secondary"
                          className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        >
                          {k}
                        </Badge>
                      ))}
                      {result.missing_keys.length > 20 && (
                        <span className="text-xs text-muted-foreground">
                          ...共 {result.missing_keys.length} 个
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function SheetResultCard({
  result,
}: {
  result: ValidationResult["sheets"][number];
}) {
  const [open, setOpen] = useState(true);
  const [valuesOpen, setValuesOpen] = useState(false);
  const hasUniqueValues =
    result.unique_values &&
    Object.keys(result.unique_values).length > 0 &&
    Object.values(result.unique_values).some((v) => v.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-lg border",
          result.found ? "border-border" : "border-destructive/30"
        )}
      >
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            {result.found ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm font-medium">{result.sheet_name}</span>
            {result.found && (
              <span className="text-xs text-muted-foreground">
                {result.total_rows} 行
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {result.found && (
              <span className="text-xs text-muted-foreground">
                填充率 {Math.round(result.fill_rate * 100)}%
              </span>
            )}
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            {!result.found ? (
              <p className="text-xs text-destructive">工作表不存在</p>
            ) : (
              <>
                {/* Column status */}
                {result.missing_columns.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground mr-2">
                      缺失列:
                    </span>
                    {result.missing_columns.map((c) => (
                      <Badge
                        key={c}
                        variant="destructive"
                        className="text-xs mr-1"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
                {result.extra_columns.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground mr-2">
                      额外列:
                    </span>
                    {result.extra_columns.map((c) => (
                      <Badge
                        key={c}
                        variant="secondary"
                        className="text-xs mr-1"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Fill rate bar */}
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>填充率</span>
                    <span>{Math.round(result.fill_rate * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        fillRateColor(result.fill_rate)
                      )}
                      style={{ width: `${result.fill_rate * 100}%` }}
                    />
                  </div>
                </div>

                {/* Empty cells */}
                {result.empty_cells.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      空单元格 ({result.empty_cells.length})
                    </p>
                    <div className="max-h-40 overflow-auto rounded border border-border text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium">
                              行
                            </th>
                            <th className="px-2 py-1 text-left font-medium">
                              列
                            </th>
                            <th className="px-2 py-1 text-left font-medium">
                              字段
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.empty_cells.slice(0, 100).map((cell, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-2 py-1">{cell.row}</td>
                              <td className="px-2 py-1">{cell.column}</td>
                              <td className="px-2 py-1">{cell.field}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {result.empty_cells.length > 100 && (
                        <p className="px-2 py-1 text-muted-foreground border-t border-border">
                          ...还有 {result.empty_cells.length - 100} 条
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Numeric violations */}
                {result.numeric_violations.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-1.5">
                      数值格式错误 ({result.numeric_violations.length})
                    </p>
                    <div className="max-h-40 overflow-auto rounded border border-destructive/20 text-xs">
                      <table className="w-full">
                        <thead className="bg-destructive/5 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium">
                              行
                            </th>
                            <th className="px-2 py-1 text-left font-medium">
                              列
                            </th>
                            <th className="px-2 py-1 text-left font-medium">
                              值
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.numeric_violations.slice(0, 50).map(
                            (v, i) => (
                              <tr
                                key={i}
                                className="border-t border-destructive/10"
                              >
                                <td className="px-2 py-1">{v.row}</td>
                                <td className="px-2 py-1">{v.column}</td>
                                <td className="px-2 py-1 font-mono">
                                  {v.value}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                      {result.numeric_violations.length > 50 && (
                        <p className="px-2 py-1 text-muted-foreground border-t border-destructive/10">
                          ...还有 {result.numeric_violations.length - 50} 条
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Image summary */}
                {result.image_summary && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Image className="h-3.5 w-3.5" />
                    <span>
                      {result.image_summary.total_images} 张图片,{" "}
                      {result.image_summary.rows_with_images} 行包含图片
                    </span>
                  </div>
                )}

                {/* Unique values */}
                {hasUniqueValues && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setValuesOpen(!valuesOpen)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {valuesOpen ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      唯一值统计
                    </button>
                    {valuesOpen && (
                      <div className="mt-2 space-y-2 pl-4">
                        {Object.entries(result.unique_values).map(
                          ([field, values]) =>
                            values.length > 0 && (
                              <div key={field}>
                                <p className="text-xs font-medium text-muted-foreground">
                                  {field} ({values.length})
                                </p>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {values.slice(0, 10).map((v, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {v}
                                    </Badge>
                                  ))}
                                  {values.length > 10 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{values.length - 10}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <div className="space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                      >
                        <Info className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ValidationDetailView({
  results,
}: {
  results: ValidationResult;
}) {
  return (
    <div className="space-y-4">
      <OverallStatusBanner results={results} />
      {results.summary && <SummarySheetCard result={results.summary} />}
      {results.sheets.map((sr) => (
        <SheetResultCard key={sr.sheet_name} result={sr} />
      ))}
    </div>
  );
}

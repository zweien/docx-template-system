"use client";

import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ScanSearch, Upload, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface TableColumn {
  key: string;
  label: string;
}

interface PlaceholderRow {
  id?: string;
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA" | "TABLE";
  required: boolean;
  defaultValue: string;
  sortOrder: number;
  enablePicker?: boolean;
  sourceTableId?: string | null;
  sourceField?: string | null;
  columns?: TableColumn[];
  description?: string;
}

interface DataTableWithFields {
  id: string;
  name: string;
  fields: Array<{ id: string; key: string; label: string }>;
}

export interface PlaceholderConfigTableHandle {
  save: () => Promise<boolean>;
}

export const PlaceholderConfigTable = forwardRef<PlaceholderConfigTableHandle, {
  templateId: string;
  hideActions?: boolean;
}>(({ templateId, hideActions = false }, ref) => {
  const [placeholders, setPlaceholders] = useState<PlaceholderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Source binding dialog state
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] = useState<PlaceholderRow | null>(null);
  const [enablePicker, setEnablePicker] = useState(false);
  const [sourceTableId, setSourceTableId] = useState<string | null>(null);
  const [sourceField, setSourceField] = useState<string | null>(null);
  const [availableTables, setAvailableTables] = useState<DataTableWithFields[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [savingSource, setSavingSource] = useState(false);

  const fetchPlaceholders = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates/${templateId}`);
      if (!res.ok) {
        toast.error("获取模板信息失败");
        return;
      }
      const data = await res.json();
      if (data.data?.placeholders) {
        setPlaceholders(
          data.data.placeholders.map(
            (ph: Record<string, unknown>) =>
              ({
                id: ph.id,
                key: ph.key,
                label: ph.label,
                inputType: ph.inputType ?? "TEXT",
                required: ph.required ?? false,
                defaultValue: ph.defaultValue ?? "",
                sortOrder: ph.sortOrder ?? 0,
                enablePicker: ph.enablePicker ?? false,
                sourceTableId: ph.sourceTableId ?? null,
                sourceField: ph.sourceField ?? null,
                columns: ph.columns as TableColumn[] | undefined,
                description: (ph.description as string) ?? "",
              }) as PlaceholderRow
          )
        );
      }
    } catch {
      toast.error("获取模板信息失败");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchPlaceholders();
  }, [fetchPlaceholders]);

  // Load available tables when dialog opens and enablePicker is true
  useEffect(() => {
    if (!isSourceDialogOpen || !enablePicker) return;

    const fetchTables = async () => {
      setLoadingTables(true);
      try {
        const res = await fetch("/api/data-tables");
        if (!res.ok) throw new Error("获取数据表失败");
        const tables = await res.json();

        // Fetch fields for each table
        const tablesWithFields = await Promise.all(
          tables.map(async (t: { id: string; name: string }) => {
            const fieldsRes = await fetch(`/api/data-tables/${t.id}/fields`);
            const fields = fieldsRes.ok ? await fieldsRes.json() : [];
            return { id: t.id, name: t.name, fields };
          })
        );

        setAvailableTables(tablesWithFields);
      } catch (error) {
        console.error("获取数据表失败:", error);
        toast.error("获取数据表失败");
      } finally {
        setLoadingTables(false);
      }
    };

    fetchTables();
  }, [isSourceDialogOpen, enablePicker]);

  // Initialize state when editingPlaceholder changes
  useEffect(() => {
    if (editingPlaceholder) {
      setEnablePicker(editingPlaceholder.enablePicker ?? false);
      setSourceTableId(editingPlaceholder.sourceTableId ?? null);
      setSourceField(editingPlaceholder.sourceField ?? null);
    }
  }, [editingPlaceholder]);

  const updateRow = (index: number, field: keyof PlaceholderRow, value: unknown) => {
    setPlaceholders((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleOpenSourceDialog = (placeholder: PlaceholderRow) => {
    setEditingPlaceholder(placeholder);
    setIsSourceDialogOpen(true);
  };

  const handleSaveSourceBinding = async () => {
    if (!editingPlaceholder?.id) {
      toast.error("占位符 ID 不存在");
      return;
    }

    setSavingSource(true);
    try {
      const res = await fetch(`/api/placeholders/${editingPlaceholder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTableId: enablePicker ? sourceTableId : null,
          sourceField: enablePicker ? sourceField : null,
          enablePicker,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "保存数据源绑定失败");
        return;
      }

      toast.success("数据源绑定已保存");

      // Update local state
      setPlaceholders((prev) =>
        prev.map((p) =>
          p.id === editingPlaceholder.id
            ? {
                ...p,
                enablePicker,
                sourceTableId: enablePicker ? sourceTableId : null,
                sourceField: enablePicker ? sourceField : null,
              }
            : p
        )
      );

      setIsSourceDialogOpen(false);
      setEditingPlaceholder(null);
    } catch (error) {
      console.error("保存数据源绑定失败:", error);
      toast.error("保存数据源绑定失败");
    } finally {
      setSavingSource(false);
    }
  };

  const handleParse = async () => {
    setParsing(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/placeholders`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "解析占位符失败");
        return;
      }
      toast.success("占位符解析成功");
      // Reload data after parsing
      const detailRes = await fetch(`/api/templates/${templateId}`);
      if (detailRes.ok) {
        const data = await detailRes.json();
        if (data.data?.placeholders) {
          setPlaceholders(
            data.data.placeholders.map(
              (ph: Record<string, unknown>) =>
                ({
                  id: ph.id,
                  key: ph.key,
                  label: ph.label,
                  inputType: ph.inputType ?? "TEXT",
                  required: ph.required ?? false,
                  defaultValue: ph.defaultValue ?? "",
                  sortOrder: ph.sortOrder ?? 0,
                  enablePicker: ph.enablePicker ?? false,
                  sourceTableId: ph.sourceTableId ?? null,
                  sourceField: ph.sourceField ?? null,
                  columns: ph.columns as TableColumn[] | undefined,
                  description: (ph.description as string) ?? "",
                }) as PlaceholderRow
            )
          );
        }
      }
    } catch {
      toast.error("解析占位符失败，请重试");
    } finally {
      setParsing(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/templates/${templateId}/placeholders/import`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "导入失败");
        return;
      }

      const result = await res.json();
      if (result.data) {
        setPlaceholders(
          result.data.map(
            (row: Record<string, unknown>, index: number) =>
              ({
                key: row.key,
                label: row.label,
                inputType: (row.inputType as "TEXT" | "TEXTAREA") ?? "TEXT",
                required: row.required === "true" || row.required === true,
                defaultValue: row.defaultValue ?? "",
                sortOrder: index,
              }) as PlaceholderRow
          )
        );
        toast.success(`成功导入 ${result.data.length} 个占位符`);
      }
    } catch {
      toast.error("导入失败，请重试");
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    // Validate
    if (placeholders.length === 0) {
      toast.error("至少需要一个占位符");
      return false;
    }
    const emptyLabel = placeholders.find((row) => !row.label.trim());
    if (emptyLabel) {
      toast.error(`占位符「${emptyLabel.key}」的标签不能为空`);
      return false;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/placeholders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeholders }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "保存失败");
        return false;
      }
      toast.success("占位符配置已保存");
      if (!hideActions) {
        router.push(`/templates/${templateId}`);
        router.refresh();
      }
      return true;
    } catch {
      toast.error("保存失败，请重试");
      return false;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({ save: handleSave }), [placeholders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      {!hideActions && (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/templates/${templateId}`} />}
        >
          <ArrowLeft className="h-4 w-4" />
          返回模板详情
        </Button>
      )}

      {/* Parse & Import buttons */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            从 DOCX 文件中重新解析占位符，将覆盖当前配置。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            从 Excel 导入
          </Button>
          <Button variant="secondary" size="sm" onClick={handleParse} disabled={parsing}>
            {parsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4" />
            )}
            解析占位符
          </Button>
        </div>
      </div>

      {/* Editable table */}
      {placeholders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-muted-foreground">
          <ScanSearch className="mb-2 h-8 w-8" />
          <p className="text-sm">暂无占位符</p>
          <p className="text-xs">
            点击上方「解析占位符」按钮从 DOCX 模板中提取占位符
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">键名</TableHead>
                <TableHead className="min-w-[160px]">标签</TableHead>
                <TableHead className="min-w-[160px]">备注</TableHead>
                <TableHead className="w-[130px]">输入类型</TableHead>
                <TableHead className="w-[70px]">必填</TableHead>
                <TableHead className="w-[140px]">默认值</TableHead>
                <TableHead className="w-[80px]">排序</TableHead>
                <TableHead className="w-[100px]">数据源</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {placeholders.map((row, index) => (
                <TableRow key={row.id ?? row.key}>
                  {/* Key - read-only, gray text */}
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.key}
                  </TableCell>

                  {/* Label - editable */}
                  <TableCell>
                    <Input
                      value={row.label}
                      onChange={(e) =>
                        updateRow(index, "label", e.target.value)
                      }
                      placeholder="输入标签"
                      className="h-7 text-sm"
                    />
                  </TableCell>

                  {/* Description - editable with inline save */}
                  <TableCell>
                    <Input
                      value={row.description ?? ""}
                      onChange={(e) =>
                        updateRow(index, "description", e.target.value)
                      }
                      onBlur={() => {
                        if (row.id && row.description !== undefined) {
                          fetch(`/api/placeholders/${row.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ description: row.description || null }),
                          }).catch(() => {});
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && row.id) {
                          fetch(`/api/placeholders/${row.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ description: row.description || null }),
                          }).catch(() => {});
                        }
                      }}
                      placeholder="备注说明"
                      className="h-7 text-sm"
                    />
                  </TableCell>

                  {/* Input Type - select */}
                  <TableCell>
                    <Select
                      value={row.inputType}
                      onValueChange={(val) =>
                        updateRow(index, "inputType", val)
                      }
                    >
                      <SelectTrigger size="sm" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEXT">单行文本</SelectItem>
                        <SelectItem value="TEXTAREA">多行文本</SelectItem>
                        <SelectItem value="TABLE">明细表</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Required - switch */}
                  <TableCell>
                    <div className="flex justify-center">
                      <Switch
                        checked={row.required}
                        onCheckedChange={(checked) =>
                          updateRow(index, "required", checked)
                        }
                        size="sm"
                      />
                    </div>
                  </TableCell>

                  {row.inputType === "TABLE" ? (
                    /* TABLE type: show columns preview */
                    <TableCell colSpan={4}>
                      {row.columns && row.columns.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.columns.map((col) => (
                            <span
                              key={col.key}
                              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono"
                            >
                              {col.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">无列定义</span>
                      )}
                    </TableCell>
                  ) : (
                    <>
                      {/* Default Value - editable */}
                      <TableCell>
                        <Input
                          value={row.defaultValue}
                          onChange={(e) =>
                            updateRow(index, "defaultValue", e.target.value)
                          }
                          placeholder="无"
                          className="h-7 text-sm"
                        />
                      </TableCell>

                      {/* Sort Order - number */}
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={row.sortOrder}
                          onChange={(e) =>
                            updateRow(index, "sortOrder", Number(e.target.value))
                          }
                          className="h-7 w-16 text-sm"
                        />
                      </TableCell>

                      {/* Data Source - config button */}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenSourceDialog(row)}
                          className={row.enablePicker ? "text-primary" : "text-muted-foreground"}
                        >
                          <Settings2 className="h-4 w-4" />
                          {row.enablePicker ? "已配置" : "配置"}
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Action buttons */}
      {!hideActions && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            render={<Link href={`/templates/${templateId}`} />}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || placeholders.length === 0}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            保存配置
          </Button>
        </div>
      )}

      {/* Source Binding Dialog */}
      <Dialog open={isSourceDialogOpen} onOpenChange={setIsSourceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              配置数据源 - {editingPlaceholder?.key}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Enable Picker Switch */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={enablePicker}
                onCheckedChange={setEnablePicker}
                id="enable-picker"
              />
              <Label htmlFor="enable-picker">启用数据选择</Label>
            </div>

            {/* Data Source Configuration */}
            {enablePicker && (
              <div className="space-y-4 border-t pt-4">
                {loadingTables ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">加载数据表...</span>
                  </div>
                ) : (
                  <>
                    {/* Source Table Select */}
                    <div className="space-y-2">
                      <Label htmlFor="source-table">数据来源表</Label>
                      <Select
                        value={sourceTableId ?? ""}
                        onValueChange={(v) => {
                          setSourceTableId(v);
                          setSourceField(null);
                        }}
                      >
                        <SelectTrigger id="source-table">
                          {sourceTableId && availableTables.length > 0
                            ? availableTables.find((t) => t.id === sourceTableId)?.name ?? sourceTableId
                            : <SelectValue placeholder="选择数据表" />}
                        </SelectTrigger>
                        <SelectContent>
                          {availableTables.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Source Field Select */}
                    {sourceTableId && (
                      <div className="space-y-2">
                        <Label htmlFor="source-field">数据字段</Label>
                        <Select
                          value={sourceField ?? ""}
                          onValueChange={setSourceField}
                        >
                          <SelectTrigger id="source-field">
                            {sourceField && availableTables.length > 0
                              ? availableTables
                                  .find((t) => t.id === sourceTableId)
                                  ?.fields.find((f) => f.key === sourceField)?.label ?? sourceField
                              : <SelectValue placeholder="选择字段" />}
                          </SelectTrigger>
                          <SelectContent>
                            {availableTables
                              .find((t) => t.id === sourceTableId)
                              ?.fields.map((f) => (
                                <SelectItem key={f.id} value={f.key}>
                                  {f.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSourceDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveSourceBinding}
              disabled={savingSource || (enablePicker && (!sourceTableId || !sourceField))}
            >
              {savingSource && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

PlaceholderConfigTable.displayName = "PlaceholderConfigTable";

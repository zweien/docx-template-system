"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

interface PlaceholderRow {
  id?: string;
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA";
  required: boolean;
  defaultValue: string;
  sortOrder: number;
}

export function PlaceholderConfigTable({
  templateId,
}: {
  templateId: string;
}) {
  const [placeholders, setPlaceholders] = useState<PlaceholderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const router = useRouter();

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

  const updateRow = (index: number, field: keyof PlaceholderRow, value: unknown) => {
    setPlaceholders((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
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

  const handleSave = async () => {
    // Validate
    if (placeholders.length === 0) {
      toast.error("至少需要一个占位符");
      return;
    }
    const emptyLabel = placeholders.find((row) => !row.label.trim());
    if (emptyLabel) {
      toast.error(`占位符「${emptyLabel.key}」的标签不能为空`);
      return;
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
        return;
      }
      toast.success("占位符配置已保存");
      router.push(`/templates/${templateId}`);
      router.refresh();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

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
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/templates/${templateId}`} />}
      >
        <ArrowLeft className="h-4 w-4" />
        返回模板详情
      </Button>

      {/* Parse button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            从 DOCX 文件中重新解析占位符，将覆盖当前配置。
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleParse} disabled={parsing}>
          {parsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="h-4 w-4" />
          )}
          解析占位符
        </Button>
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
                <TableHead className="w-[160px]">键名</TableHead>
                <TableHead>标签</TableHead>
                <TableHead className="w-[130px]">输入类型</TableHead>
                <TableHead className="w-[70px]">必填</TableHead>
                <TableHead className="w-[140px]">默认值</TableHead>
                <TableHead className="w-[80px]">排序</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Action buttons */}
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
    </div>
  );
}

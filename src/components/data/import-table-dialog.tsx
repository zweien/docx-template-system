"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ImportTableDialogProps {
  trigger?: React.ReactElement;
}

interface SingleSummary {
  mode: "single";
  tableName: string;
  fieldCount: number;
  recordCount: number;
  description?: string;
}

interface BundleSummary {
  mode: "bundle";
  rootTable: string;
  tableCount: number;
  totalRecords: number;
  tables: Array<{ name: string; fieldCount: number; recordCount: number }>;
}

type Summary = SingleSummary | BundleSummary;

export function ImportTableDialog({ trigger }: ImportTableDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError("");
    setSummary(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);

        // Detect version 2.0 bundle format
        if (data.version === "2.0" && data.tables && typeof data.tables === "object") {
          const tables = Object.entries(data.tables as Record<string, { fields: unknown[]; records: unknown[] }>).map(
            ([name, t]) => ({
              name,
              fieldCount: t.fields?.length ?? 0,
              recordCount: t.records?.length ?? 0,
            })
          );
          const totalRecords = tables.reduce((sum, t) => sum + t.recordCount, 0);
          setSummary({
            mode: "bundle",
            rootTable: data.rootTable ?? tables[0]?.name ?? "未知",
            tableCount: tables.length,
            totalRecords,
            tables,
          });
          return;
        }

        // Version 1.0 single-table format
        if (!data.version || !data.table?.name || !Array.isArray(data.fields) || !Array.isArray(data.records)) {
          setError("JSON 格式不正确，需要包含 version、table、fields 和 records");
          return;
        }
        setSummary({
          mode: "single",
          tableName: data.table.name,
          fieldCount: data.fields.length,
          recordCount: data.records.length,
          description: data.table.description || undefined,
        });
      } catch {
        setError("JSON 文件解析失败");
      }
    };
    reader.readAsText(selected);
  };

  const handleImport = async () => {
    if (!file || !summary) return;

    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/data-tables/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "导入失败");
        return;
      }

      setOpen(false);
      setFile(null);
      setSummary(null);

      if (summary.mode === "bundle") {
        const tableNames = data.tables?.map((t: { tableName: string }) => t.tableName).join("、");
        toast.success(
          `成功导入 ${data.tables?.length ?? 0} 个数据表：${tableNames}，共建立 ${data.relationLinksCreated ?? 0} 个关联`
        );
        router.push("/data");
      } else {
        const skipped = data.skippedRelationFields?.length
          ? `（已跳过 ${data.skippedRelationFields.length} 个关系字段）`
          : "";
        toast.success(
          `数据表「${data.tableName}」创建成功，${data.fieldCount} 个字段，${data.recordCount} 条记录${skipped}`
        );
        router.push(`/data/${data.tableId}`);
      }
      router.refresh();
    } catch {
      setError("导入失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setError("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              导入数据表
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>导入数据表</DialogTitle>
          <DialogDescription>
            上传 JSON 导出文件，创建包含字段和记录的完整数据表
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="border-2 border-dashed border-zinc-200 rounded-lg p-6 text-center">
            <Input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
              id="table-import-file"
            />
            <label
              htmlFor="table-import-file"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-400 mb-3"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              <span className="text-zinc-600 text-sm">
                {file ? file.name : "点击上传 .json 文件"}
              </span>
            </label>
          </div>

          {summary?.mode === "single" && (
            <div className="border rounded-lg p-4 bg-muted text-sm space-y-1">
              <div className="font-medium">{summary.tableName}</div>
              {summary.description && (
                <div className="text-zinc-500">{summary.description}</div>
              )}
              <div className="text-zinc-600 mt-2">
                {summary.fieldCount} 个字段 · {summary.recordCount} 条记录
              </div>
            </div>
          )}

          {summary?.mode === "bundle" && (
            <div className="border rounded-lg p-4 bg-muted text-sm space-y-2">
              <div className="font-medium">
                关联数据导出（包含 {summary.tableCount} 个表，共 {summary.totalRecords} 条记录）
              </div>
              <div className="divide-y">
                {summary.tables.map((t) => (
                  <div key={t.name} className="flex justify-between py-1.5">
                    <span>{t.name}</span>
                    <span className="text-zinc-500">
                      {t.fieldCount} 字段 · {t.recordCount} 记录
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={!summary || isLoading}
          >
            {isLoading ? "导入中..." : "导入"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { DataFieldItem, ImportPreview, ImportResult } from "@/types/data-table";

interface ImportWizardProps {
  tableId: string;
  fields: DataFieldItem[];
}

type Step = "upload" | "mapping" | "options" | "result";

export function ImportWizard({ tableId, fields }: ImportWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [uniqueField, setUniqueField] = useState("");
  const [strategy, setStrategy] = useState<"skip" | "overwrite">("skip");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  // Step 1: Upload
  const handleUpload = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/data-tables/${tableId}/import/preview`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "上传失败");
        return;
      }

      setPreview(data);
      // Initialize mapping with null (not imported)
      const initialMapping: Record<string, string | null> = {};
      data.columns.forEach((col: string) => {
        // Try to auto-match by label or key
        const matchedField = fields.find(
          (f) =>
            f.label.toLowerCase() === col.toLowerCase() ||
            f.key.toLowerCase() === col.toLowerCase()
        );
        initialMapping[col] = matchedField?.key ?? null;
      });
      setMapping(initialMapping);
      setStep("mapping");
    } catch (err) {
      setError("上传失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, [file, tableId, fields]);

  // Step 3: Import
  const handleImport = useCallback(async () => {
    if (!preview) return;

    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file!);
      formData.append(
        "config",
        JSON.stringify({
          mapping,
          options: {
            uniqueField,
            strategy,
          },
        })
      );

      const response = await fetch(`/api/data-tables/${tableId}/import`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "导入失败");
        return;
      }

      setResult(data);
      setStep("result");
    } catch (err) {
      setError("导入失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, [file, preview, mapping, uniqueField, strategy, tableId]);

  // Render steps
  const renderUploadStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">上传 Excel 文件</h2>
        <p className="text-zinc-500 text-sm mt-1">
          支持 .xlsx 格式，最大 5MB，最多 1000 行
        </p>
      </div>

      <div className="border-2 border-dashed border-zinc-200 rounded-lg p-8 text-center">
        <Input
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              setFile(selectedFile);
              setError("");
            }
          }}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-zinc-400 mb-4"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <span className="text-zinc-600">
            {file ? file.name : "点击或拖拽上传文件"}
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleUpload} disabled={!file || isLoading}>
          {isLoading ? "解析中..." : "下一步"}
        </Button>
      </div>
    </div>
  );

  const renderMappingStep = () => {
    if (!preview) return null;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">字段映射</h2>
          <p className="text-zinc-500 text-sm mt-1">
            将 Excel 列映射到数据表字段
          </p>
        </div>

        <div className="border rounded-lg divide-y">
          {preview.columns.map((col) => (
            <div key={col} className="flex items-center p-3 gap-4">
              <div className="w-1/3 font-medium">{col}</div>
              <div className="text-zinc-400">→</div>
              <div className="flex-1">
                <Select
                  value={mapping[col] ?? ""}
                  onValueChange={(v) => {
                    setMapping({ ...mapping, [col]: v || null });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="不导入" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">不导入</SelectItem>
                    {fields.map((f) => (
                      <SelectItem key={f.id} value={f.key}>
                        {f.label} ({f.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <div className="text-sm text-zinc-500">
          预览：共 {preview.totalRows} 行数据
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep("upload")}>
            上一步
          </Button>
          <Button onClick={() => setStep("options")}>下一步</Button>
        </div>
      </div>
    );
  };

  const renderOptionsStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">导入选项</h2>
        <p className="text-zinc-500 text-sm mt-1">
          配置重复数据处理方式
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>唯一标识字段</Label>
          <Select value={uniqueField} onValueChange={(v) => setUniqueField(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="选择用于判断重复的字段" />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.key}>
                  {f.label} ({f.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-zinc-500">
            根据此字段判断是否为重复记录
          </p>
        </div>

        <div className="space-y-2">
          <Label>发现重复记录时</Label>
          <RadioGroup
            value={strategy}
            onValueChange={(v) => setStrategy(v as "skip" | "overwrite")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="skip" id="skip" />
              <label htmlFor="skip" className="text-sm">
                跳过（保留原有数据）
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="overwrite" id="overwrite" />
              <label htmlFor="overwrite" className="text-sm">
                覆盖（更新原有数据）
              </label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep("mapping")}>
          上一步
        </Button>
        <Button onClick={handleImport} disabled={isLoading}>
          {isLoading ? "导入中..." : "开始导入"}
        </Button>
      </div>
    </div>
  );

  const renderResultStep = () => {
    if (!result) return null;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">导入完成</h2>
          <p className="text-zinc-500 text-sm mt-1">数据已成功导入</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {result.created}
            </div>
            <div className="text-sm text-green-600">新增</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {result.updated}
            </div>
            <div className="text-sm text-blue-600">更新</div>
          </div>
          <div className="bg-zinc-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-zinc-600">
              {result.skipped}
            </div>
            <div className="text-sm text-zinc-600">跳过</div>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="border rounded-lg p-4">
            <h3 className="font-medium text-red-600 mb-2">
              错误 ({result.errors.length})
            </h3>
            <ul className="text-sm text-zinc-600 space-y-1 max-h-40 overflow-auto">
              {result.errors.slice(0, 10).map((err, i) => (
                <li key={i}>
                  行 {err.row}: {err.message}
                </li>
              ))}
              {result.errors.length > 10 && (
                <li className="text-zinc-400">
                  ...还有 {result.errors.length - 10} 条错误
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => {
              router.push(`/data/${tableId}`);
              router.refresh();
            }}
          >
            完成
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm mb-2">
          {["上传文件", "字段映射", "导入选项", "完成"].map((label, i) => {
            const stepIndex = ["upload", "mapping", "options", "result"].indexOf(step);
            return (
              <div
                key={label}
                className={`flex items-center ${
                  i <= stepIndex ? "text-zinc-900" : "text-zinc-400"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    i < stepIndex
                      ? "bg-green-500 text-white"
                      : i === stepIndex
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-200"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                <span className="ml-2">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 transition-all"
            style={{
              width: `${
                ((["upload", "mapping", "options", "result"].indexOf(step) + 1) /
                  4) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border p-6">
        {step === "upload" && renderUploadStep()}
        {step === "mapping" && renderMappingStep()}
        {step === "options" && renderOptionsStep()}
        {step === "result" && renderResultStep()}
      </div>
    </div>
  );
}

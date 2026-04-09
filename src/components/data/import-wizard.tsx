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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import type { DataFieldItem, ImportPreview, ImportResult, DataTableDetail } from "@/types/data-table";
import {
  CreateFieldDialog,
  type CreateFieldFormData,
} from "@/components/data/create-field-dialog";

interface ImportWizardProps {
  tableId?: string;
  fields: DataFieldItem[];
  table?: DataTableDetail;
}

type ImportMode = "normal" | "relation";
type Step = "upload" | "mapping" | "options" | "result";

export function ImportWizard({ tableId, fields, table }: ImportWizardProps) {
  const router = useRouter();
  const [importMode, setImportMode] = useState<ImportMode>("normal");
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [uniqueField, setUniqueField] = useState("");
  const [strategy, setStrategy] = useState<"skip" | "overwrite">("skip");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  // 创建字段相关 state
  const [localFields, setLocalFields] = useState<DataFieldItem[]>(fields);
  const [createFieldForColumn, setCreateFieldForColumn] = useState<string | null>(null);

  // JSON 导入 state
  const [isJsonFile, setIsJsonFile] = useState(false);
  const [jsonSummary, setJsonSummary] = useState<{
    tableName: string;
    fieldCount: number;
    recordCount: number;
  } | null>(null);

  // 关系明细导入 state
  const [selectedRelationField, setSelectedRelationField] = useState<string>("");
  const [sourceMapping, setSourceMapping] = useState<Record<string, string>>({});
  const [targetMapping, setTargetMapping] = useState<Record<string, string>>({});
  const [attributeMapping, setAttributeMapping] = useState<Record<string, string>>({});
  const [targetTableFields, setTargetTableFields] = useState<DataFieldItem[]>([]);
  const [targetTableId, setTargetTableId] = useState<string>("");

  // Step 1: Upload
  const handleUpload = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError("");

    try {
      const isJson = file.name.endsWith(".json");

      if (isJson) {
        // JSON 文件：前端解析，展示摘要
        const text = await file.text();
        const jsonData = JSON.parse(text);

        if (!jsonData.version || !Array.isArray(jsonData.fields) || !Array.isArray(jsonData.records)) {
          setError("JSON 文件格式不正确，缺少 version、fields 或 records 字段");
          setIsLoading(false);
          return;
        }

        setIsJsonFile(true);
        setJsonSummary({
          tableName: jsonData.table?.name ?? "未知",
          fieldCount: jsonData.fields.length,
          recordCount: jsonData.records.length,
        });

        // 设置预览数据
        const columns = jsonData.fields.map((f: { key: string }) => f.key);
        const previewRows = jsonData.records.slice(0, 5);
        setPreview({
          columns,
          rows: previewRows,
          totalRows: jsonData.records.length,
        });

        // 自动映射（key 直接匹配）
        const initialMapping: Record<string, string | null> = {};
        const fieldKeySet = new Set(localFields.map((f) => f.key));
        for (const jsonField of jsonData.fields) {
          initialMapping[jsonField.key] = fieldKeySet.has(jsonField.key) ? jsonField.key : null;
        }
        setMapping(initialMapping);

        // JSON 跳过映射步骤，直接到选项
        setStep("options");
      } else {
        // Excel 文件：走原有逻辑
        setIsJsonFile(false);
        setJsonSummary(null);

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
        const initialMapping: Record<string, string | null> = {};
        data.columns.forEach((col: string) => {
          const matchedField = localFields.find(
            (f) =>
              f.label.toLowerCase() === col.toLowerCase() ||
              f.key.toLowerCase() === col.toLowerCase()
          );
          initialMapping[col] = matchedField?.key ?? null;
        });
        setMapping(initialMapping);
        setStep("mapping");
      }
    } catch (_err) {
      setError(isJsonFile ? "JSON 文件解析失败" : "上传失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, [file, tableId, localFields, isJsonFile]);

  // 创建新字段
  const handleCreateField = useCallback(
    async (formData: CreateFieldFormData) => {
      if (!createFieldForColumn || !tableId) return;

      setError("");

      const newField = {
        key: formData.key,
        label: formData.label,
        type: formData.type,
        required: formData.required,
        options: formData.options.length > 0 ? formData.options : null,
        defaultValue: formData.defaultValue || null,
        sortOrder: localFields.length,
      };

      // 构建完整字段列表发送到后端
      const updatedFields = [...localFields, newField];

      try {
        const response = await fetch(`/api/data-tables/${tableId}/fields`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: updatedFields }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "创建字段失败");
          return;
        }

        // 更新本地字段列表
        setLocalFields(data);

        // 自动将新字段映射到触发列
        const createdField = data.find(
          (f: DataFieldItem) => f.key === formData.key
        );
        if (createdField) {
          setMapping((prev) => ({
            ...prev,
            [createFieldForColumn]: createdField.key,
          }));
        }

        toast.success(`字段「${formData.label}」创建成功`);
        setCreateFieldForColumn(null);
      } catch (_err) {
        setError("创建字段失败，请稍后重试");
      }
    },
    [createFieldForColumn, tableId, localFields]
  );

  // Select 下拉变更处理
  const handleMappingChange = (col: string, value: string | null) => {
    if (value === "__create_new__") {
      // 将该列 mapping 重置为 null，打开创建字段 Dialog
      setMapping((prev) => ({ ...prev, [col]: null }));
      setCreateFieldForColumn(col);
    } else {
      setMapping((prev) => ({ ...prev, [col]: value || null }));
    }
  };

  // Step 3: Import
  const handleImport = useCallback(async () => {
    if (!preview) return;

    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file!);

      if (importMode === "relation") {
        // 关系明细导入
        const relationField = localFields.find((f) => f.id === selectedRelationField);
        if (!relationField || !tableId) {
          setError("请选择关系字段");
          return;
        }

        const sourceBusinessKeys = table?.businessKeys ?? [];
        const targetBusinessKeys = (() => {
          const keys: string[] = [];
          for (const fieldKey of Object.values(targetMapping)) {
            if (fieldKey) keys.push(fieldKey);
          }
          return keys;
        })();

        if (sourceBusinessKeys.length === 0) {
          setError("当前表未配置业务唯一键，请先在字段配置中设置");
          return;
        }

        formData.append(
          "config",
          JSON.stringify({
            relationFieldKey: relationField.key,
            sourceMapping,
            targetMapping,
            attributeMapping,
            sourceBusinessKeys,
            targetBusinessKeys,
            targetTableId,
          })
        );

        const response = await fetch(`/api/data-tables/${tableId}/relation-import`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "导入失败");
          return;
        }

        setResult(data);
      } else {
        // 普通导入 或 JSON 导入
        if (isJsonFile) {
          // JSON 导入：发送文件 + config 到 JSON 导入接口
          const jsonFormData = new FormData();
          jsonFormData.append("file", file!);
          jsonFormData.append(
            "config",
            JSON.stringify({ strategy })
          );

          const response = await fetch(`/api/data-tables/${tableId}/import/json`, {
            method: "POST",
            body: jsonFormData,
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || "导入失败");
            return;
          }

          setResult(data);
        } else {
          // Excel 普通导入
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
        }
      }

      setStep("result");
    } catch (_err) {
      setError("导入失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }, [file, preview, mapping, uniqueField, strategy, tableId, importMode, selectedRelationField, sourceMapping, targetMapping, attributeMapping, targetTableId, localFields, table]);

  // 关系明细导入：加载目标表字段
  const handleRelationFieldChange = useCallback(async (fieldId: string | null) => {
    if (!fieldId) return;
    setSelectedRelationField(fieldId);
    const field = localFields.find((f) => f.id === fieldId);
    if (!field?.relationTo) return;

    setTargetTableId(field.relationTo);
    try {
      const response = await fetch(`/api/data-tables/${field.relationTo}`);
      if (response.ok) {
        const data = await response.json();
        setTargetTableFields(data.fields ?? []);
      }
    } catch {
      // ignore
    }
  }, [localFields]);

  // Render steps
  const renderUploadStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">上传文件</h2>
        <p className="text-zinc-500 text-sm mt-1">
          支持 .xlsx 和 .json 格式，最大 5MB，最多 1000 行
        </p>
      </div>

      {/* 导入模式选择 */}
      {table && (
        <div className="space-y-2">
          <Label>导入模式</Label>
          <RadioGroup
            value={importMode}
            onValueChange={(v) => setImportMode(v as ImportMode)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="normal" id="mode-normal" />
              <label htmlFor="mode-normal" className="text-sm">
                主表数据导入
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="relation" id="mode-relation" />
              <label htmlFor="mode-relation" className="text-sm">
                关系明细导入（按唯一键匹配主记录与关联记录）
              </label>
            </div>
          </RadioGroup>
        </div>
      )}

      <div className="border-2 border-dashed border-zinc-200 rounded-lg p-8 text-center">
        <Input
          type="file"
          accept=".xlsx,.json"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              setFile(selectedFile);
              setError("");
              if (selectedFile.name.endsWith(".json")) {
                setImportMode("normal"); // JSON 仅支持主表导入
              }
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

      {jsonSummary && (
        <div className="border rounded-lg p-4 bg-muted text-sm space-y-1">
          <div>来源表：{jsonSummary.tableName}</div>
          <div>字段数：{jsonSummary.fieldCount}</div>
          <div>记录数：{jsonSummary.recordCount}</div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleUpload} disabled={!file || isLoading}>
          {isLoading ? "解析中..." : "下一步"}
        </Button>
      </div>
    </div>
  );

  const renderMappingStep = () => {
    if (!preview) return null;

    // 关系明细导入映射
    if (importMode === "relation") {
      const relationFields = localFields.filter(
        (f) => f.type === "RELATION_SUBTABLE" && f.relationTo
      );

      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium">关系明细映射</h2>
            <p className="text-zinc-500 text-sm mt-1">
              选择关系字段，将 Excel 列映射到源表唯一键、目标表唯一键和边属性
            </p>
          </div>

          {/* 选择关系字段 */}
          <div className="space-y-2">
            <Label>关系字段</Label>
            <Select value={selectedRelationField} onValueChange={handleRelationFieldChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择关系字段" />
              </SelectTrigger>
              <SelectContent>
                {relationFields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label} ({f.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRelationField && (
            <>
              {/* 源表唯一键映射 */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm">源表唯一键列映射</h3>
                {table?.businessKeys?.map((bk) => {
                  const field = localFields.find((f) => f.key === bk);
                  return (
                    <div key={bk} className="flex items-center gap-4">
                      <div className="w-1/3 text-sm">{field?.label ?? bk}</div>
                      <div className="text-zinc-400">→</div>
                      <Select
                        value={sourceMapping[bk] ?? ""}
                        onValueChange={(v) =>
                          setSourceMapping((prev) => ({ ...prev, [bk]: v ?? "" }))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="选择 Excel 列" />
                        </SelectTrigger>
                        <SelectContent>
                          {preview.columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              {/* 目标表唯一键映射 */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm">目标表唯一键列映射</h3>
                {targetTableFields
                  .filter((f) => f.type === "TEXT" || f.type === "NUMBER" || f.type === "SELECT")
                  .map((f) => (
                    <div key={f.key} className="flex items-center gap-4">
                      <div className="w-1/3 text-sm">
                        {f.label} ({f.key})
                      </div>
                      <div className="text-zinc-400">→</div>
                      <Select
                        value={targetMapping[f.key] ?? ""}
                        onValueChange={(v) =>
                          setTargetMapping((prev) => ({ ...prev, [f.key]: v ?? "" }))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="选择 Excel 列" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">不导入</SelectItem>
                          {preview.columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
              </div>

              {/* 边属性列映射 */}
              {(() => {
                const relationField = localFields.find((f) => f.id === selectedRelationField);
                const attrFields = relationField?.relationSchema?.fields ?? [];
                if (attrFields.length === 0) return null;
                return (
                  <div className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm">边属性列映射</h3>
                    {attrFields.map((f) => (
                      <div key={f.key} className="flex items-center gap-4">
                        <div className="w-1/3 text-sm">{f.label}</div>
                        <div className="text-zinc-400">→</div>
                        <Select
                          value={attributeMapping[f.key] ?? ""}
                          onValueChange={(v) =>
                            setAttributeMapping((prev) => ({ ...prev, [f.key]: v ?? "" }))
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="选择 Excel 列" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">不导入</SelectItem>
                            {preview.columns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          <div className="text-sm text-zinc-500">
            预览：共 {preview.totalRows} 行数据
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              上一步
            </Button>
            <Button
              onClick={() => setStep("options")}
              disabled={!selectedRelationField}
            >
              下一步
            </Button>
          </div>
        </div>
      );
    }

    // 普通导入映射
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">字段映射</h2>
          <p className="text-zinc-500 text-sm mt-1">
            将 Excel 列映射到数据表字段，也可以新建字段
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
                  onValueChange={(v) => handleMappingChange(col, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="不导入" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">不导入</SelectItem>
                    {localFields.map((f) => (
                      <SelectItem key={f.id} value={f.key}>
                        {f.label} ({f.key})
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value="__create_new__">
                      + 新建字段
                    </SelectItem>
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
        {!isJsonFile && (
        <div className="space-y-2">
          <Label>唯一标识字段</Label>
          <Select value={uniqueField} onValueChange={(v) => setUniqueField(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="选择用于判断重复的字段" />
            </SelectTrigger>
            <SelectContent>
              {localFields.map((f) => (
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
        )}

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
        <Button variant="outline" onClick={() => setStep(isJsonFile ? "upload" : "mapping")}>
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
          <div className="bg-muted rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">
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
          {(isJsonFile
            ? ["上传文件", "导入选项", "完成"]
            : ["上传文件", "字段映射", "导入选项", "完成"]
          ).map((label, i) => {
            const steps = isJsonFile
              ? ["upload", "options", "result"]
              : ["upload", "mapping", "options", "result"];
            const stepIndex = steps.indexOf(step);
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
                (((
                  isJsonFile
                    ? ["upload", "options", "result"]
                    : ["upload", "mapping", "options", "result"]
                ).indexOf(step) +
                  1) /
                  (isJsonFile ? 3 : 4)) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border p-6">
        {step === "upload" && renderUploadStep()}
        {step === "mapping" && renderMappingStep()}
        {step === "options" && renderOptionsStep()}
        {step === "result" && renderResultStep()}
      </div>

      {/* Create Field Dialog */}
      {createFieldForColumn && (
        <CreateFieldDialog
          open={!!createFieldForColumn}
          onOpenChange={(open) => {
            if (!open) setCreateFieldForColumn(null);
          }}
          columnLabel={createFieldForColumn}
          existingKeys={localFields.map((f) => f.key)}
          onSubmit={handleCreateField}
        />
      )}
    </div>
  );
}

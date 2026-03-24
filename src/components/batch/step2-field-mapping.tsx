"use client";

import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import type { FieldMapping } from "@/types/batch-generation";

interface PlaceholderInfo {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
}

interface DataFieldInfo {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  sortOrder: number;
}

interface Step2FieldMappingProps {
  templateId: string;
  dataTableId: string;
  fieldMapping: FieldMapping;
  onMappingChange: (mapping: FieldMapping) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function Step2FieldMapping({
  templateId,
  dataTableId,
  fieldMapping,
  onMappingChange,
  onPrev,
  onNext,
}: Step2FieldMappingProps) {
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);
  const [dataFields, setDataFields] = useState<DataFieldInfo[]>([]);
  const [autoMapping, setAutoMapping] = useState<FieldMapping>({});
  const [isLoading, setIsLoading] = useState(true);
  const hasInitializedMapping = useRef(false);

  // 加载字段映射信息
  useEffect(() => {
    const fetchMappingInfo = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/templates/${templateId}/field-mapping?dataTableId=${dataTableId}`
        );
        const result = await response.json();
        if (response.ok) {
          setPlaceholders(result.placeholders);
          setDataFields(result.dataFields);
          setAutoMapping(result.autoMapping);
          // 仅在首次加载时且没有手动映射时，使用自动映射
          if (!hasInitializedMapping.current && Object.keys(fieldMapping).length === 0) {
            hasInitializedMapping.current = true;
            onMappingChange(result.autoMapping);
          }
        }
      } catch (error) {
        console.error("获取字段映射信息失败:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMappingInfo();
    // 注意: fieldMapping 和 onMappingChange 故意不添加到依赖中
    // 我们只需要在 templateId/dataTableId 变化时获取数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, dataTableId]);

  const handleMappingUpdate = (placeholderKey: string, dataFieldKey: string | null) => {
    onMappingChange({
      ...fieldMapping,
      [placeholderKey]: dataFieldKey,
    });
  };

  const validateMapping = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const requiredPlaceholders = placeholders.filter((p) => p.required);

    for (const placeholder of requiredPlaceholders) {
      const mappedField = fieldMapping[placeholder.key];
      if (!mappedField) {
        errors.push(`必填字段 "${placeholder.label}" 未映射`);
      }
    }

    return { valid: errors.length === 0, errors };
  };

  const { valid, errors } = validateMapping();
  const canNext = valid;

  // 计算映射统计
  const mappedCount = Object.values(fieldMapping).filter((v) => v !== null).length;
  const requiredMappedCount = placeholders
    .filter((p) => p.required)
    .filter((p) => fieldMapping[p.key]).length;
  const requiredTotal = placeholders.filter((p) => p.required).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">字段映射</h2>
        <p className="text-zinc-500 text-sm mt-1">
          将模板占位符映射到数据表字段
        </p>
      </div>

      {/* 统计信息 */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {mappedCount} / {placeholders.length} 已映射
          </Badge>
        </div>
        {requiredTotal > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant={requiredMappedCount === requiredTotal ? "default" : "destructive"}>
              必填: {requiredMappedCount} / {requiredTotal}
            </Badge>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 font-medium mb-2">
            <AlertCircle className="h-4 w-4" />
            请完成以下必填字段的映射
          </div>
          <ul className="text-sm text-red-600 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-zinc-500">加载中...</div>
      ) : (
        /* 映射表格 */
        <div className="border rounded-lg divide-y">
          {placeholders.map((placeholder) => {
            const currentValue = fieldMapping[placeholder.key];
            const isAutoMapped = autoMapping[placeholder.key] === currentValue;

            return (
              <div key={placeholder.id} className="flex items-center p-4 gap-4">
                <div className="w-1/3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{placeholder.label}</span>
                    {placeholder.required && (
                      <Badge variant="destructive" className="text-xs">必填</Badge>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    {"{{"} {placeholder.key} {"}}"}
                  </span>
                </div>

                <div className="text-zinc-400">→</div>

                <div className="flex-1">
                  <Select
                    value={currentValue || ""}
                    onValueChange={(v) => handleMappingUpdate(placeholder.key, v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不映射（使用默认值）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">不映射</SelectItem>
                      {dataFields.map((field) => (
                        <SelectItem key={field.id} value={field.key}>
                          {field.label} ({field.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isAutoMapped && currentValue && (
                  <Badge variant="outline" className="text-xs">
                    自动
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 底部导航 */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          上一步
        </Button>
        <Button onClick={onNext} disabled={!canNext}>
          下一步
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

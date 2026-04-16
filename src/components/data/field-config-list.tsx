"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldConfigForm } from "./field-config-form";
import type { DataFieldItem, DataTableListItem } from "@/types/data-table";
import { parseSelectOptions, SELECT_COLORS } from "@/types/data-table";
import type { DataFieldInput } from "@/validators/data-table";
import { FieldType } from "@/generated/prisma/enums";

interface FieldConfigListProps {
  tableId: string;
  fields: DataFieldItem[];
  availableTables: DataTableListItem[];
  businessKeys?: string[];
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  [FieldType.TEXT]: "文本",
  [FieldType.NUMBER]: "数字",
  [FieldType.DATE]: "日期",
  [FieldType.SELECT]: "单选",
  [FieldType.MULTISELECT]: "多选",
  [FieldType.EMAIL]: "邮箱",
  [FieldType.PHONE]: "电话",
  [FieldType.FILE]: "附件",
  [FieldType.RELATION]: "关联",
  [FieldType.RELATION_SUBTABLE]: "关系子表格",
  [FieldType.URL]: "URL",
  [FieldType.BOOLEAN]: "勾选框",
  [FieldType.AUTO_NUMBER]: "自动编号",
  [FieldType.SYSTEM_TIMESTAMP]: "创建/修改时间",
  [FieldType.SYSTEM_USER]: "创建/修改人",
  [FieldType.FORMULA]: "公式",
};

function buildInverseFieldPreview(key: string): string {
  const baseKey = key.trim() || "field";
  return `${baseKey}_inverse`;
}

function getInverseFieldLabel(field: DataFieldItem): string {
  if (field.inverseFieldKey) {
    return field.inverseFieldKey;
  }

  if (!field.id) {
    return buildInverseFieldPreview(field.key);
  }

  return "-";
}

function toFieldItem(
  data: DataFieldInput,
  fallbackSortOrder: number,
  existing?: DataFieldItem
): DataFieldItem {
  return {
    id: data.id ?? existing?.id ?? `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    key: data.key,
    label: data.label,
    type: data.type,
    required: data.required ?? false,
    options: data.options ?? undefined,
    relationTo: data.relationTo ?? undefined,
    displayField: data.displayField ?? undefined,
    relationCardinality: (data.relationCardinality ?? undefined) as
      | DataFieldItem["relationCardinality"]
      | undefined,
    inverseRelationCardinality: (data.inverseRelationCardinality ?? undefined) as
      | DataFieldItem["inverseRelationCardinality"]
      | undefined,
    inverseFieldId: data.inverseFieldId ?? existing?.inverseFieldId ?? null,
    inverseFieldKey: existing?.inverseFieldKey ?? null,
    isSystemManagedInverse: data.isSystemManagedInverse ?? existing?.isSystemManagedInverse,
    relationSchema: (data.relationSchema ?? existing?.relationSchema ?? null) as
      | DataFieldItem["relationSchema"]
      | null,
    defaultValue: data.defaultValue ?? undefined,
    sortOrder: data.sortOrder ?? existing?.sortOrder ?? fallbackSortOrder,
  };
}

export function FieldConfigList({
  tableId,
  fields: initialFields,
  availableTables,
  businessKeys: initialBusinessKeys,
}: FieldConfigListProps) {
  const router = useRouter();
  const [fields, setFields] = useState<DataFieldItem[]>(
    initialFields.map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options,
      relationTo: f.relationTo,
      displayField: f.displayField,
      relationCardinality: f.relationCardinality,
      inverseRelationCardinality: f.inverseRelationCardinality,
      inverseFieldId: f.inverseFieldId,
      inverseFieldKey: f.inverseFieldKey,
      isSystemManagedInverse: f.isSystemManagedInverse,
      relationSchema: f.relationSchema,
      defaultValue: f.defaultValue,
      sortOrder: f.sortOrder,
    }))
  );
  const [businessKeys, setBusinessKeys] = useState<string[]>(
    initialBusinessKeys ?? []
  );
  const [editingField, setEditingField] = useState<DataFieldItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddField = (data: DataFieldInput) => {
    setFields([...fields, toFieldItem(data, fields.length)]);
    setIsFormOpen(false);
  };

  const handleEditField = (data: DataFieldInput) => {
    if (!editingField) return;
    setFields(
      fields.map((f) =>
        f.id === editingField.id ? toFieldItem(data, f.sortOrder, f) : f
      )
    );
    setEditingField(null);
    setIsFormOpen(false);
  };

  const handleDeleteField = (id: string) => {
    if (!confirm("确定要删除这个字段吗？")) return;
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/data-tables/${tableId}/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, businessKeys }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "保存失败");
        return;
      }

      // Update local state from API response to ensure consistency with DB
      if (Array.isArray(result)) {
        setFields(result as DataFieldItem[]);
      }

      router.refresh();
      alert("字段配置已保存");
    } catch (error) {
      console.error("保存失败:", error);
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // Get tables with their fields for relation config
  const tablesWithFields = availableTables.map((t) => ({
    id: t.id,
    name: t.name,
    fields: t.id === tableId ? initialFields : [],
  }));

  // Handle opening the edit form - find field from current fields state
  const handleOpenEdit = (field: DataFieldItem) => {
    setEditingField(field as DataFieldItem);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">字段配置</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingField(null);
              setIsFormOpen(true);
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1"
            >
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            添加字段
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存全部"}
          </Button>
        </div>
      </div>

      {/* 业务唯一键配置 */}
      <div className="rounded-md border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">业务唯一键</h3>
          <span className="text-xs text-zinc-400">
            用于导入时匹配已有记录（最多 5 个字段）
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {fields
            .filter((f) => f.type !== "RELATION" && f.type !== "RELATION_SUBTABLE")
            .map((f) => {
              const isSelected = businessKeys.includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setBusinessKeys((prev) =>
                      isSelected
                        ? prev.filter((k) => k !== f.key)
                        : prev.length < 5
                          ? [...prev, f.key]
                          : prev
                    )
                  }
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
                    isSelected
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-card text-muted-foreground border-border hover:border-border-hover"
                  }`}
                >
                  {f.label}
                  <span className="opacity-60 font-mono">({f.key})</span>
                </button>
              );
            })}
          {businessKeys.length === 0 && (
            <span className="text-xs text-zinc-400 py-1">
              未选择 — 导入时需手动指定唯一字段
            </span>
          )}
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          暂无字段，点击「添加字段」开始配置
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">字段标识</TableHead>
                <TableHead className="w-[150px]">显示名称</TableHead>
                <TableHead className="w-[100px]">类型</TableHead>
                <TableHead className="w-[80px]">必填</TableHead>
                <TableHead>选项/关联</TableHead>
                <TableHead className="w-[120px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id ?? index}>
                  <TableCell className="font-mono text-sm">
                    {field.key}
                  </TableCell>
                  <TableCell>{field.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {FIELD_TYPE_LABELS[field.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {field.required ? (
                      <Badge variant="destructive">必填</Badge>
                    ) : (
                      <span className="text-zinc-400">可选</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {field.type === FieldType.SELECT ||
                    field.type === FieldType.MULTISELECT ? (
                      <div className="flex flex-wrap gap-1">
                        {parseSelectOptions(field.options).slice(0, 4).map((opt, i) => {
                          const preset = SELECT_COLORS.find(c => c.bg === opt.color);
                          return (
                          <span
                            key={i}
                              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: opt.color, color: preset?.fg ?? "#374151" }}
                          >
                            {opt.label}
                          </span>
                          );
                        })}
                        {parseSelectOptions(field.options).length > 4 && (
                          <span className="text-xs text-zinc-400">+{parseSelectOptions(field.options).length - 4}</span>
                        )}
                      </div>
                    ) : field.type === FieldType.RELATION_SUBTABLE ? (
                      <div className="space-y-1 text-sm text-zinc-500">
                        <div>
                          关联目标:
                          {availableTables.find((t) => t.id === field.relationTo)?.name ??
                            field.relationTo ??
                            "-"}
                        </div>
                        <div>本侧基数: {field.relationCardinality ?? "-"}</div>
                        <div>
                          反向字段: {getInverseFieldLabel(field)}
                          {" / "}
                          {field.inverseRelationCardinality ?? "-"}
                        </div>
                        <div>边属性: {field.relationSchema?.fields?.length ?? 0}</div>
                      </div>
                    ) : field.type === FieldType.RELATION ? (
                      <span className="text-sm text-zinc-500">
                        关联表 / 显示: {field.displayField}
                      </span>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => handleOpenEdit(field)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-red-600"
                        onClick={() => field.id && handleDeleteField(field.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FieldConfigForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingField(null);
        }}
        field={editingField}
        fields={fields}
        tableId={tableId}
        availableTables={tablesWithFields}
        existingFieldKeys={fields.map((f) => f.key)}
        onSubmit={editingField ? handleEditField : handleAddField}
      />
    </div>
  );
}

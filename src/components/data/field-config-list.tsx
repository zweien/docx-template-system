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
import type { DataFieldInput } from "@/validators/data-table";
import { FieldType } from "@/generated/prisma/enums";

interface FieldConfigListProps {
  tableId: string;
  fields: DataFieldItem[];
  availableTables: DataTableListItem[];
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
};

export function FieldConfigList({
  tableId,
  fields: initialFields,
  availableTables,
}: FieldConfigListProps) {
  const router = useRouter();
  const [fields, setFields] = useState<DataFieldInput[]>(
    initialFields.map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options,
      relationTo: f.relationTo,
      displayField: f.displayField,
      defaultValue: f.defaultValue,
      sortOrder: f.sortOrder,
    }))
  );
  const [editingField, setEditingField] = useState<DataFieldItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddField = (data: DataFieldInput) => {
    setFields([...fields, { ...data, sortOrder: fields.length }]);
    setIsFormOpen(false);
  };

  const handleEditField = (data: DataFieldInput) => {
    setFields(
      fields.map((f) =>
        f.id === editingField?.id ? { ...data, id: editingField.id } : f
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
        body: JSON.stringify({ fields }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "保存失败");
        return;
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

      {fields.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          暂无字段，点击"添加字段"开始配置
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
                      <span className="text-sm text-zinc-500">
                        {field.options?.slice(0, 3).join(", ")}
                        {field.options && field.options.length > 3 && "..."}
                      </span>
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
                        onClick={() => {
                          setEditingField(initialFields.find(f => f.id === field.id) ?? null);
                          setIsFormOpen(true);
                        }}
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
        availableTables={tablesWithFields}
        onSubmit={editingField ? handleEditField : handleAddField}
      />
    </div>
  );
}

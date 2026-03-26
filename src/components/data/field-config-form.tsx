"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem } from "@/types/data-table";
import type { DataFieldInput } from "@/validators/data-table";

interface FieldConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: DataFieldItem | null;
  availableTables: { id: string; name: string; fields: DataFieldItem[] }[];
  onSubmit: (data: DataFieldInput) => void;
}

const FIELD_TYPES = [
  { value: FieldType.TEXT, label: "文本" },
  { value: FieldType.NUMBER, label: "数字" },
  { value: FieldType.DATE, label: "日期" },
  { value: FieldType.SELECT, label: "单选" },
  { value: FieldType.MULTISELECT, label: "多选" },
  { value: FieldType.EMAIL, label: "邮箱" },
  { value: FieldType.PHONE, label: "电话" },
  { value: FieldType.FILE, label: "附件" },
  { value: FieldType.RELATION, label: "关联字段" },
];

export function FieldConfigForm({
  open,
  onOpenChange,
  field,
  availableTables,
  onSubmit,
}: FieldConfigFormProps) {
  const [key, setKey] = useState(field?.key ?? "");
  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldType, setFieldType] = useState<FieldType>(field?.type ?? FieldType.TEXT);
  const [required, setRequired] = useState(field?.required ?? false);
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue ?? "");
  const [optionsText, setOptionsText] = useState(
    field?.options?.join("\n") ?? ""
  );
  const [selectedTableId, setSelectedTableId] = useState(
    field?.relationTo ?? ""
  );
  const [selectedDisplayField, setSelectedDisplayField] = useState(
    field?.displayField ?? ""
  );
  const [relationFields, setRelationFields] = useState<DataFieldItem[]>(() => {
    const t = availableTables.find((t) => t.id === (field?.relationTo ?? ""));
    return t?.fields ?? [];
  });
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");

  // When selectedTableId changes, load that table's fields
  useEffect(() => {
    if (!selectedTableId) {
      setRelationFields([]);
      return;
    }

    // Check if fields are already available locally
    const localTable = availableTables.find((t) => t.id === selectedTableId);
    if (localTable && localTable.fields.length > 0) {
      setRelationFields(localTable.fields);
      return;
    }

    // Fetch fields from API
    let cancelled = false;
    setLoadingFields(true);
    fetch(`/api/data-tables/${selectedTableId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setRelationFields(data.data.fields ?? []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingFields(false);
      });
    return () => { cancelled = true; };
  }, [selectedTableId, availableTables]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!key.trim()) {
      setError("字段标识不能为空");
      return;
    }

    if (!label.trim()) {
      setError("显示名称不能为空");
      return;
    }

    // Validate key format
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      setError("字段标识必须以小写字母开头，只能包含小写字母、数字和下划线");
      return;
    }

    const data: DataFieldInput = {
      id: field?.id,
      key: key.trim(),
      label: label.trim(),
      type: fieldType,
      required,
      defaultValue: defaultValue.trim() || undefined,
      sortOrder: field?.sortOrder ?? 0,
      options:
        fieldType === FieldType.SELECT || fieldType === FieldType.MULTISELECT
          ? optionsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      relationTo:
        fieldType === FieldType.RELATION ? selectedTableId : undefined,
      displayField:
        fieldType === FieldType.RELATION ? selectedDisplayField : undefined,
    };

    onSubmit(data);
    onOpenChange(false);
  };

  const selectedTable = availableTables.find((t) => t.id === selectedTableId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>
              {field ? "编辑字段" : "添加字段"}
            </SheetTitle>
            <SheetDescription>
              配置字段属性，不同类型有不同的配置选项
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4">
            {/* Key */}
            <div className="grid gap-2">
              <Label htmlFor="key">
                字段标识 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="key"
                placeholder="例如：project_name"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!!field}
              />
              <p className="text-xs text-zinc-500">
                英文字母开头，仅支持小写字母、数字、下划线
              </p>
            </div>

            {/* Label */}
            <div className="grid gap-2">
              <Label htmlFor="label">
                显示名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="label"
                placeholder="例如：项目名称"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            {/* Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">字段类型</Label>
              <Select
                value={fieldType}
                onValueChange={(v) => setFieldType(v as FieldType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Required */}
            <div className="flex items-center justify-between">
              <Label htmlFor="required">是否必填</Label>
              <Switch
                checked={required}
                onCheckedChange={setRequired}
              />
            </div>

            {/* Options for SELECT/MULTISELECT */}
            {(fieldType === FieldType.SELECT || fieldType === FieldType.MULTISELECT) && (
              <div className="grid gap-2">
                <Label htmlFor="options">选项列表</Label>
                <Textarea
                  id="options"
                  placeholder="每行一个选项，例如：&#10;进行中&#10;已完成&#10;已取消"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-zinc-500">
                  每行一个选项值
                </p>
              </div>
            )}

            {/* Relation config */}
            {fieldType === FieldType.RELATION && (
              <>
                <div className="grid gap-2">
                  <Label>关联到表</Label>
                  <Select
                    value={selectedTableId}
                    onValueChange={(v) => {
                      setSelectedTableId(v ?? "");
                      setSelectedDisplayField("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择关联表" />
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

                {selectedTable && (
                  <div className="grid gap-2">
                    <Label>显示字段</Label>
                    <Select
                      value={selectedDisplayField}
                      onValueChange={(v) => setSelectedDisplayField(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingFields ? "加载中..." : "选择显示字段"} />
                      </SelectTrigger>
                      <SelectContent>
                        {relationFields.map((f) => (
                          <SelectItem key={f.id} value={f.key}>
                            {f.label} ({f.key})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            {/* Default Value */}
            <div className="grid gap-2">
              <Label htmlFor="defaultValue">默认值</Label>
              <Input
                id="defaultValue"
                placeholder="可选"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit">
              保存
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

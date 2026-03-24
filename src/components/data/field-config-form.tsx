"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { dataFieldItemSchema, type DataFieldInput } from "@/validators/data-table";

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
  const [fieldType, setFieldType] = useState<FieldType>(field?.type ?? FieldType.TEXT);
  const [optionsText, setOptionsText] = useState(
    field?.options?.join("\n") ?? ""
  );
  const [selectedTableId, setSelectedTableId] = useState(
    field?.relationTo ?? ""
  );
  const [selectedDisplayField, setSelectedDisplayField] = useState(
    field?.displayField ?? ""
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DataFieldInput>({
    resolver: zodResolver(dataFieldItemSchema),
    defaultValues: {
      id: field?.id,
      key: field?.key ?? "",
      label: field?.label ?? "",
      type: field?.type ?? FieldType.TEXT,
      required: field?.required ?? false,
      sortOrder: field?.sortOrder ?? 0,
    },
  });

  const handleFormSubmit = (data: DataFieldInput) => {
    const finalData: DataFieldInput = {
      ...data,
      type: fieldType,
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

    onSubmit(finalData);
    onOpenChange(false);
  };

  const selectedTable = availableTables.find((t) => t.id === selectedTableId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(handleFormSubmit)}>
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
                {...register("key")}
                disabled={!!field}
              />
              {errors.key && (
                <p className="text-sm text-red-500">{errors.key.message}</p>
              )}
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
                {...register("label")}
              />
              {errors.label && (
                <p className="text-sm text-red-500">{errors.label.message}</p>
              )}
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
              <Switch {...register("required")} />
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
                      setSelectedTableId(v);
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
                      onValueChange={setSelectedDisplayField}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择显示字段" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTable.fields.map((f) => (
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
                {...register("defaultValue")}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import type { DataFieldItem } from "@/types/data-table";
import { parseSelectOptions } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

interface RelationQuickCreateFormProps {
  fields: DataFieldItem[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function RelationQuickCreateForm({
  fields,
  onSubmit,
  onCancel,
  isSubmitting,
}: RelationQuickCreateFormProps) {
  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: Object.fromEntries(fields.map((f) => [f.key, ""])),
  });

  // Re-sync form when fields load asynchronously
  useEffect(() => {
    if (fields.length > 0) {
      reset(Object.fromEntries(fields.map((f) => [f.key, ""])));
    }
  }, [fields, reset]);

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    // Convert number fields
    const cleaned: Record<string, unknown> = {};
    for (const field of fields) {
      const val = data[field.key];
      if (val === "" || val == null) {
        cleaned[field.key] = null;
      } else if (field.type === FieldType.NUMBER) {
        cleaned[field.key] = Number(val);
      } else {
        cleaned[field.key] = val;
      }
    }
    await onSubmit(cleaned);
  };

  if (fields.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">
        没有必填字段，无法快速创建
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="p-2 space-y-2">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs">{field.label} *</Label>
          {field.type === FieldType.SELECT ? (
            <Select
              value={watch(field.key) ?? ""}
              onValueChange={(v) => { if (v) setValue(field.key, v); }}
            >
              <SelectTrigger size="sm" className="h-7 text-xs">
                <SelectValue placeholder={`选择${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {parseSelectOptions(field.options).map((opt) => (
                  <SelectItem key={opt.label} value={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              size={1}
              className="h-7 text-xs"
              type={field.type === FieldType.NUMBER ? "number" : field.type === FieldType.DATE ? "date" : "text"}
              step={field.type === FieldType.NUMBER ? "any" : undefined}
              placeholder={`输入${field.label}`}
              {...register(field.key)}
            />
          )}
        </div>
      ))}
      <div className="flex gap-1 pt-1">
        <Button type="button" variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" size="sm" className="flex-1 h-7 text-xs" disabled={isSubmitting}>
          {isSubmitting ? "创建中..." : "创建"}
        </Button>
      </div>
    </form>
  );
}

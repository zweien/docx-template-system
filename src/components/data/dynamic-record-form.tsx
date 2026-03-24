"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { RelationSelect } from "./relation-select";

interface DynamicRecordFormProps {
  tableId: string;
  fields: DataFieldItem[];
  initialData?: DataRecordItem | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
}

export function DynamicRecordForm({
  tableId,
  fields,
  initialData,
  onSubmit,
  submitLabel = "保存",
}: DynamicRecordFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Build schema from fields
  const schema = z.object(
    Object.fromEntries(
      fields.map((field) => {
        let fieldSchema: z.ZodTypeAny = z.string();

        switch (field.type) {
          case FieldType.NUMBER:
            fieldSchema = z.coerce.number().nullable().optional();
            break;
          case FieldType.DATE:
            fieldSchema = z.string().nullable().optional();
            break;
          case FieldType.SELECT:
            fieldSchema = z.string().nullable().optional();
            break;
          case FieldType.MULTISELECT:
            fieldSchema = z.array(z.string()).nullable().optional();
            break;
          case FieldType.EMAIL:
            fieldSchema = z.string().email().nullable().optional().or(z.literal(""));
            break;
          case FieldType.PHONE:
            fieldSchema = z.string().nullable().optional();
            break;
          case FieldType.FILE:
            fieldSchema = z.string().nullable().optional();
            break;
          case FieldType.RELATION:
            fieldSchema = z.string().nullable().optional();
            break;
          default:
            fieldSchema = z.string().nullable().optional();
        }

        if (field.required) {
          if (field.type === FieldType.NUMBER) {
            fieldSchema = z.coerce.number({ message: `${field.label}必须是数字` });
          } else if (field.type === FieldType.MULTISELECT) {
            fieldSchema = z.array(z.string()).min(1, { message: `${field.label}至少选择一项` });
          } else {
            fieldSchema = z.string().min(1, { message: `${field.label}不能为空` });
          }
        }

        return [field.key, fieldSchema];
      })
    )
  );

  const defaultValues = Object.fromEntries(
    fields.map((field) => [
      field.key,
      initialData?.data[field.key] ?? field.defaultValue ?? null,
    ])
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    setError("");
    setIsSubmitting(true);

    try {
      // Clean up null/empty values
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [
          k,
          v === "" ? null : v,
        ])
      );

      await onSubmit(cleanedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: DataFieldItem) => {
    const fieldError = errors[field.key];

    switch (field.type) {
      case FieldType.NUMBER:
        return (
          <Input
            type="number"
            step="any"
            {...register(field.key, { setValueAs: (v) => v === "" ? null : Number(v) })}
            placeholder={`输入${field.label}`}
          />
        );

      case FieldType.DATE:
        return (
          <Input
            type="date"
            {...register(field.key)}
          />
        );

      case FieldType.SELECT:
        return (
          <Select
            value={watch(field.key) ?? ""}
            onValueChange={(v) => setValue(field.key, v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`选择${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case FieldType.MULTISELECT:
        // Simplified: comma-separated input for now
        return (
          <Input
            {...register(field.key)}
            placeholder="多个值用逗号分隔"
          />
        );

      case FieldType.EMAIL:
        return (
          <Input
            type="email"
            {...register(field.key)}
            placeholder={`输入${field.label}`}
          />
        );

      case FieldType.PHONE:
        return (
          <Input
            type="tel"
            {...register(field.key)}
            placeholder={`输入${field.label}`}
          />
        );

      case FieldType.FILE:
        return (
          <Input
            {...register(field.key)}
            placeholder="文件路径"
          />
        );

      case FieldType.RELATION:
        return (
          <RelationSelect
            value={String(watch(field.key) ?? "")}
            onChange={(v) => setValue(field.key, v)}
            relationTableId={field.relationTo ?? ""}
            displayField={field.displayField ?? "id"}
            placeholder={`选择${field.label}`}
          />
        );

      default:
        return (
          <Input
            {...register(field.key)}
            placeholder={`输入${field.label}`}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {fields.map((field) => (
        <div key={field.id ?? field.key} className="grid gap-2">
          <Label htmlFor={field.key} className="flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </Label>
          {renderField(field)}
          {errors[field.key] && (
            <p className="text-sm text-red-500">
              {errors[field.key]?.message as string}
            </p>
          )}
        </div>
      ))}

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "保存中..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { parseFieldOptions } from "@/types/data-table";
import type { RelationSubtableValueItem } from "@/types/data-table";
import { parseSelectOptions } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { RelationSubtableEditor } from "./relation-subtable-editor";
import { RelationSelect } from "./relation-select";

interface DynamicRecordFormProps {
  tableId: string;
  fields: DataFieldItem[];
  initialData?: DataRecordItem | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
}

const relationSubtableItemSchema = z.object({
  targetRecordId: z.string(),
  displayValue: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int().nonnegative(),
});

function normalizeRelationSubtableValues(
  field: DataFieldItem,
  rawValue: unknown
): RelationSubtableValueItem[] {
  const items = rawValue == null
    ? []
    : Array.isArray(rawValue)
      ? rawValue
      : [rawValue];

  return items
    .filter((item): item is RelationSubtableValueItem =>
      Boolean(item) &&
      typeof item === "object" &&
      "targetRecordId" in item
    )
    .map((item, index) => ({
      targetRecordId:
        typeof item.targetRecordId === "string"
          ? item.targetRecordId
          : "",
      displayValue:
        typeof item.displayValue === "string"
          ? item.displayValue
          : undefined,
      attributes:
        item.attributes &&
        typeof item.attributes === "object" &&
        !Array.isArray(item.attributes)
          ? { ...(item.attributes as Record<string, unknown>) }
          : {},
      sortOrder: Number.isInteger(item.sortOrder)
        ? item.sortOrder
        : index,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index,
    }))
    .slice(0, field.relationCardinality === "SINGLE" ? 1 : undefined);
}

function buildRelationSubtableFieldSchema(
  field: DataFieldItem
): z.ZodTypeAny {
  const valueSchema = z
    .union([
      relationSubtableItemSchema,
      z.array(relationSubtableItemSchema),
    ])
    .nullable()
    .optional();

  if (!field.required) {
    return valueSchema;
  }

  return valueSchema.refine(
    (value) => {
      const items = value == null
        ? []
        : Array.isArray(value)
          ? value
          : [value];
      return items.some((item) => item.targetRecordId);
    },
    { message: `${field.label}不能为空` }
  );
}

function serializeRelationSubtableValue(
  field: DataFieldItem,
  rawValue: unknown
): RelationSubtableValueItem[] | RelationSubtableValueItem | null {
  const items = normalizeRelationSubtableValues(field, rawValue).filter(
    (item) => item.targetRecordId
  );

  if (field.relationCardinality === "SINGLE") {
    return items[0] ?? null;
  }

  return items;
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
          case FieldType.BOOLEAN:
            fieldSchema = z.boolean().nullable().optional();
            break;
          case FieldType.RELATION_SUBTABLE:
            fieldSchema = buildRelationSubtableFieldSchema(field);
            break;
          case FieldType.COUNT:
          case FieldType.LOOKUP:
          case FieldType.ROLLUP:
            fieldSchema = z.unknown().nullable().optional();
            break;
          default:
            fieldSchema = z.string().nullable().optional();
        }

        if (field.required) {
          if (field.type === FieldType.NUMBER) {
            fieldSchema = z.coerce.number({ message: `${field.label}必须是数字` });
          } else if (field.type === FieldType.MULTISELECT) {
            fieldSchema = z.array(z.string()).min(1, { message: `${field.label}至少选择一项` });
          } else if (field.type === FieldType.RELATION_SUBTABLE) {
            fieldSchema = buildRelationSubtableFieldSchema(field);
          } else {
            fieldSchema = z.string().min(1, { message: `${field.label}不能为空` });
          }
        }

        return [field.key, fieldSchema];
      })
    )
  );

  const defaultValues = Object.fromEntries(
    fields.map((field) => {
      if (field.type === FieldType.RELATION_SUBTABLE) {
        return [
          field.key,
          normalizeRelationSubtableValues(
            field,
            initialData?.data[field.key] ?? null
          ),
        ];
      }

      return [
        field.key,
        initialData?.data[field.key] ?? field.defaultValue ?? null,
      ];
    })
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Client-side computed field refresh (no API persistence)
  const refreshComputedFieldsLocal = useCallback(async (fieldKey: string, value: unknown) => {
    const fieldById = new Map(fields.map((f) => [f.id, f]));

    for (const cf of fields) {
      const opts = parseFieldOptions(cf.options);

      if (cf.type === FieldType.COUNT && opts.countSourceFieldId) {
        const src = fieldById.get(opts.countSourceFieldId);
        if (src && src.key === fieldKey && src.type === FieldType.RELATION) {
          const hasValue = typeof value === 'string' && value.length > 0;
          setValue(cf.key, hasValue ? 1 : 0);
        }
      }

      if (cf.type === FieldType.LOOKUP && opts.lookupSourceFieldId && opts.lookupTargetFieldKey) {
        const src = fieldById.get(opts.lookupSourceFieldId);
        if (!src || src.key !== fieldKey || src.type !== FieldType.RELATION) continue;
        const recordId = typeof value === 'string' ? value : null;
        if (!recordId || !src.relationTo) {
          setValue(cf.key, null);
          continue;
        }
        try {
          const res = await fetch(`/api/data-tables/${src.relationTo}/records/${recordId}`);
          if (res.ok) {
            const record = await res.json();
            setValue(cf.key, record?.data?.[opts.lookupTargetFieldKey] ?? null);
          }
        } catch {
          // ignore — value will update on full save
        }
      }

      if (cf.type === FieldType.ROLLUP && opts.rollupSourceFieldId && opts.rollupTargetFieldKey) {
        const src = fieldById.get(opts.rollupSourceFieldId);
        if (!src || src.key !== fieldKey || src.type !== FieldType.RELATION) continue;
        const recordId = typeof value === 'string' ? value : null;
        if (!recordId || !src.relationTo) {
          setValue(cf.key, null);
          continue;
        }
        try {
          const res = await fetch(`/api/data-tables/${src.relationTo}/records/${recordId}`);
          if (res.ok) {
            const record = await res.json();
            // SINGLE relation: take value directly, no aggregation
            setValue(cf.key, record?.data?.[opts.rollupTargetFieldKey] ?? null);
          }
        } catch {
          // ignore — value will update on full save
        }
      }
    }
  }, [fields, setValue]);

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    setError("");
    setIsSubmitting(true);

    try {
      // Clean up null/empty values
      const cleanedData = Object.fromEntries(
        fields.map((field) => {
          const value = data[field.key];
          if (field.type === FieldType.RELATION_SUBTABLE) {
            return [
              field.key,
              serializeRelationSubtableValue(field, value),
            ];
          }

          return [
            field.key,
            value === "" ? null : value,
          ];
        })
      );

      await onSubmit(cleanedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: DataFieldItem) => {
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

      case FieldType.SELECT: {
        const selectOpts = parseSelectOptions(field.options);
        return (
          <Select
            value={watch(field.key) ?? ""}
            onValueChange={(v) => setValue(field.key, v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`选择${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {selectOpts.map((option) => (
                <SelectItem key={option.label} value={option.label}>
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

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
            onChange={(v) => {
              setValue(field.key, v);
              void refreshComputedFieldsLocal(field.key, v);
            }}
            relationTableId={field.relationTo ?? ""}
            displayField={field.displayField ?? "id"}
            placeholder={`选择${field.label}`}
          />
        );

      case FieldType.RELATION_SUBTABLE:
        return (
          <RelationSubtableEditor
            field={field}
            value={normalizeRelationSubtableValues(
              field,
              watch(field.key)
            )}
            onChange={(nextValue) => setValue(field.key, nextValue)}
          />
        );

      case FieldType.BOOLEAN:
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={field.key}
              checked={!!watch(field.key)}
              onChange={(e) => setValue(field.key, e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <label htmlFor={field.key} className="text-sm text-zinc-600">
              {watch(field.key) ? "是" : "否"}
            </label>
          </div>
        );

      case FieldType.COUNT:
      case FieldType.LOOKUP:
      case FieldType.ROLLUP: {
        const rawVal = watch(field.key);
        const displayVal = Array.isArray(rawVal) ? rawVal.join(", ") : String(rawVal ?? "");
        return (
          <Input
            readOnly
            value={displayVal}
            placeholder="自动计算"
            className="bg-muted"
          />
        );
      }

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

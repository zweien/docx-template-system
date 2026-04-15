"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseSelectOptions } from "@/types/data-table";
import { Loader2 } from "lucide-react";
import type { PublicFormConfig } from "@/lib/services/form-share.service";

interface PublicFormRendererProps {
  config: PublicFormConfig;
  token: string;
}

function buildSchema(fields: PublicFormConfig["fields"]) {
  return z.object(
    Object.fromEntries(
      fields.map((field) => {
        let fieldSchema: z.ZodTypeAny;

        switch (field.type) {
          case "NUMBER":
            fieldSchema = z.coerce.number().nullable().optional();
            break;
          case "DATE":
            fieldSchema = z.string().nullable().optional();
            break;
          case "MULTISELECT":
            fieldSchema = z.array(z.string()).nullable().optional();
            break;
          case "EMAIL":
            fieldSchema = z
              .string()
              .email()
              .nullable()
              .optional()
              .or(z.literal(""));
            break;
          case "BOOLEAN":
            fieldSchema = z.boolean().nullable().optional();
            break;
          default:
            fieldSchema = z.string().nullable().optional();
        }

        if (field.required) {
          if (field.type === "NUMBER") {
            fieldSchema = z.coerce.number({
              message: `${field.label}必须是数字`,
            });
          } else if (field.type === "MULTISELECT") {
            fieldSchema = z
              .array(z.string())
              .min(1, { message: `${field.label}至少选择一项` });
          } else {
            fieldSchema = z.string().min(1, {
              message: `${field.label}不能为空`,
            });
          }
        }

        return [field.key, fieldSchema];
      })
    )
  );
}

export function PublicFormRenderer({ config, token }: PublicFormRendererProps) {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = buildSchema(config.fields);
  const defaultValues = Object.fromEntries(
    config.fields.map((f) => [f.key, null])
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

  const onSubmit = async (data: Record<string, unknown>) => {
    setSubmitError("");
    setIsSubmitting(true);

    // Clean null/empty values
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
    );

    try {
      const res = await fetch(`/api/public/form/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: cleaned }),
      });

      const result = await res.json();

      if (result.success) {
        setSubmitted(true);
      } else {
        setSubmitError(
          result.error?.message || "提交失败，请稍后重试"
        );
      }
    } catch {
      setSubmitError("网络错误，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-green-100 text-green-600 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">
          {config.successMessage || "提交成功！"}
        </h2>
        {config.allowMultipleSubmissions && (
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setSubmitted(false);
            }}
          >
            再次填写
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {config.layout.groups.map((group) => {
        const groupFields = group.fieldKeys
          .map((key) => config.fields.find((f) => f.key === key))
          .filter(Boolean) as PublicFormConfig["fields"];

        if (groupFields.length === 0) return null;

        return (
          <div key={group.id}>
            {group.title && (
              <h3 className="text-sm font-medium mb-3">{group.title}</h3>
            )}
            <div className="space-y-4">
              {groupFields.map((field) => (
                <div key={field.key} className="grid gap-1.5">
                  <Label className="text-sm flex items-center gap-1">
                    {field.label}
                    {field.required && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <PublicFormField
                    field={field}
                    register={register}
                    setValue={setValue}
                    watch={watch}
                  />
                  {errors[field.key] && (
                    <p className="text-sm text-destructive">
                      {String(errors[field.key]?.message ?? "")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {submitError && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {submitError}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            提交中...
          </>
        ) : (
          config.submitButtonText || "提交"
        )}
      </Button>
    </form>
  );
}

function PublicFormField({
  field,
  register,
  setValue,
  watch,
}: {
  field: PublicFormConfig["fields"][number];
  register: ReturnType<typeof useForm>["register"];
  setValue: ReturnType<typeof useForm>["setValue"];
  watch: ReturnType<typeof useForm>["watch"];
}) {
  switch (field.type) {
    case "NUMBER":
      return (
        <Input
          type="number"
          step="any"
          {...register(field.key, {
            setValueAs: (v: string) => (v === "" ? null : Number(v)),
          })}
          placeholder={`输入${field.label}`}
        />
      );

    case "DATE":
      return <Input type="date" {...register(field.key)} />;

    case "SELECT": {
      const selectOpts = parseSelectOptions(field.options);
      return (
        <Select
          value={String(watch(field.key) ?? "")}
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
                    className="w-3 h-3 rounded-full shrink-0"
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

    case "MULTISELECT":
      return (
        <Input
          {...register(field.key)}
          placeholder="多个值用逗号分隔"
        />
      );

    case "EMAIL":
      return (
        <Input
          type="email"
          {...register(field.key)}
          placeholder="email@example.com"
        />
      );

    case "PHONE":
      return (
        <Input
          type="tel"
          {...register(field.key)}
          placeholder="输入电话"
        />
      );

    case "URL":
      return (
        <Input
          type="url"
          {...register(field.key)}
          placeholder="https://"
        />
      );

    case "BOOLEAN":
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={field.key}
            checked={!!watch(field.key)}
            onChange={(e) => setValue(field.key, e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <label htmlFor={field.key} className="text-sm text-muted-foreground">
            {watch(field.key) ? "是" : "否"}
          </label>
        </div>
      );

    case "FILE":
      return <Input {...register(field.key)} placeholder="文件路径" />;

    default:
      return (
        <Input
          {...register(field.key)}
          placeholder={`输入${field.label}`}
        />
      );
  }
}

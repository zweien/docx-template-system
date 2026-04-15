"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { parseSelectOptions } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem, FormViewOptions } from "@/types/data-table";

interface FormPreviewProps {
  options: FormViewOptions;
  fields: DataFieldItem[];
}

export function FormPreview({ options, fields }: FormPreviewProps) {
  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 border-b">
          <h1 className="text-xl font-semibold">
            {options.formTitle || "未命名表单"}
          </h1>
          {options.formDescription && (
            <p className="mt-2 text-sm text-muted-foreground">
              {options.formDescription}
            </p>
          )}
        </div>

        <form
          className="p-6 space-y-5"
          onSubmit={(e) => e.preventDefault()}
        >
          {options.layout.groups.map((group) => {
            const groupFields = group.fieldKeys
              .map((key) => fields.find((f) => f.key === key))
              .filter(Boolean) as DataFieldItem[];

            if (groupFields.length === 0) return null;

            return (
              <div key={group.id}>
                {group.title && (
                  <div className="mb-3">
                    <h3 className="text-sm font-medium">{group.title}</h3>
                  </div>
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
                      <PreviewFieldInput field={field} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <Button className="w-full mt-6">
            {options.submitButtonText || "提交"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function PreviewFieldInput({ field }: { field: DataFieldItem }) {
  const disabled = true; // Preview mode - read only

  switch (field.type) {
    case FieldType.NUMBER:
      return (
        <Input
          type="number"
          disabled={disabled}
          placeholder={`输入${field.label}`}
        />
      );

    case FieldType.DATE:
      return <Input type="date" disabled={disabled} />;

    case FieldType.SELECT: {
      const selectOpts = parseSelectOptions(field.options);
      return (
        <div className="flex gap-1.5 flex-wrap">
          {selectOpts.length > 0 ? (
            selectOpts.map((opt) => (
              <span
                key={opt.label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border"
                style={{
                  backgroundColor: opt.color + "33",
                  borderColor: opt.color,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">无选项</span>
          )}
        </div>
      );
    }

    case FieldType.MULTISELECT:
      return <Input disabled={disabled} placeholder="多个值用逗号分隔" />;

    case FieldType.EMAIL:
      return (
        <Input type="email" disabled={disabled} placeholder="email@example.com" />
      );

    case FieldType.PHONE:
      return <Input type="tel" disabled={disabled} placeholder="输入电话" />;

    case FieldType.URL:
      return <Input type="url" disabled={disabled} placeholder="https://" />;

    case FieldType.BOOLEAN:
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={disabled}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm text-muted-foreground">是/否</span>
        </div>
      );

    case FieldType.FILE:
      return (
        <div className="border rounded-md px-3 py-2 text-sm text-muted-foreground">
          点击上传文件
        </div>
      );

    case FieldType.RELATION:
      return (
        <Input disabled={disabled} placeholder="搜索关联记录..." />
      );

    default:
      return (
        <Input disabled={disabled} placeholder={`输入${field.label}`} />
      );
  }
}

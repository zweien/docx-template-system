"use client";

import { useEffect, useMemo, useState } from "react";
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
import type {
  DataFieldItem,
  RelationCardinality,
  RelationSchemaField,
  SelectOption,
} from "@/types/data-table";
import { parseSelectOptions, SELECT_COLORS } from "@/types/data-table";
import { parseFieldOptions } from "@/types/data-table";
import type { DataFieldInput } from "@/validators/data-table";

interface FieldConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: DataFieldItem | null;
  availableTables: { id: string; name: string; fields: DataFieldItem[] }[];
  existingFieldKeys?: string[];
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
  { value: FieldType.URL, label: "URL" },
  { value: FieldType.BOOLEAN, label: "勾选框" },
  { value: FieldType.AUTO_NUMBER, label: "自动编号" },
  { value: FieldType.SYSTEM_TIMESTAMP, label: "创建/修改时间" },
  { value: FieldType.SYSTEM_USER, label: "创建/修改人" },
  { value: FieldType.FORMULA, label: "公式" },
  { value: FieldType.RELATION, label: "关联字段" },
  { value: FieldType.RELATION_SUBTABLE, label: "关系子表格" },
];

const RELATION_SCHEMA_FIELD_TYPES = FIELD_TYPES.filter(
  (item) => item.value !== FieldType.RELATION && item.value !== FieldType.RELATION_SUBTABLE
);

type RelationSchemaFieldDraft = {
  key: string;
  label: string;
  type: Exclude<FieldType, "RELATION" | "RELATION_SUBTABLE">;
  required: boolean;
  optionsText: string;
};

function getFieldTypeLabel(type: FieldType): string {
  return FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
}

function buildInverseFieldPreview(key: string): string {
  const baseKey = key.trim() || "field";
  return `${baseKey}_inverse`;
}

function buildRelationSchemaDraft(
  fields: RelationSchemaField[] | undefined | null
): RelationSchemaFieldDraft[] {
  return (fields ?? []).map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    optionsText: field.options?.join("\n") ?? "",
  }));
}

function buildRelationSchemaPayload(
  fields: RelationSchemaFieldDraft[]
): NonNullable<DataFieldInput["relationSchema"]> {
  return {
    version: 1,
    fields: fields.map((field, index) => ({
      key: field.key.trim(),
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      options:
        field.type === FieldType.SELECT || field.type === FieldType.MULTISELECT
          ? field.optionsText
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
      sortOrder: index,
    })),
  };
}

function emptyRelationSchemaFieldDraft(): RelationSchemaFieldDraft {
  return {
    key: "",
    label: "",
    type: FieldType.TEXT,
    required: false,
    optionsText: "",
  };
}

function hasDuplicateRelationSchemaKeys(fields: RelationSchemaFieldDraft[]): boolean {
  const seen = new Set<string>();

  for (const field of fields) {
    const key = field.key.trim();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }

  return false;
}

export function FieldConfigForm({
  open,
  onOpenChange,
  field,
  availableTables,
  existingFieldKeys = [],
  onSubmit,
}: FieldConfigFormProps) {
  // Initialize state from field prop - only run once when field changes
  const [key, setKey] = useState(() => field?.key ?? "");
  const [label, setLabel] = useState(() => field?.label ?? "");
  const [fieldType, setFieldType] = useState<FieldType>(() => field?.type ?? FieldType.TEXT);
  const [required, setRequired] = useState(() => field?.required ?? false);
  const [defaultValue, setDefaultValue] = useState(() => field?.defaultValue ?? "");
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>(() =>
    parseSelectOptions(field?.options)
  );
  const [selectedTableId, setSelectedTableId] = useState(() => field?.relationTo ?? "");
  const [selectedDisplayField, setSelectedDisplayField] = useState(() => field?.displayField ?? "");
  const [relationCardinality, setRelationCardinality] = useState<RelationCardinality>(() =>
    field?.relationCardinality ?? "SINGLE"
  );
  const [inverseRelationCardinality, setInverseRelationCardinality] = useState<RelationCardinality>(() =>
    field?.inverseRelationCardinality ?? (field?.relationCardinality === "MULTIPLE" ? "MULTIPLE" : "SINGLE")
  );
  const [relationSchemaFields, setRelationSchemaFields] = useState<RelationSchemaFieldDraft[]>(() =>
    buildRelationSchemaDraft(field?.relationSchema?.fields)
  );
  const [relationFields, setRelationFields] = useState<DataFieldItem[]>(() => {
    if (field?.relationTo) {
      const table = availableTables.find((item) => item.id === field.relationTo);
      return table?.fields ?? [];
    }
    return [];
  });
  const [loadingFields, setLoadingFields] = useState(false);
  const [formulaExpression, setFormulaExpression] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.formula ?? "";
  });
  const [systemFieldKind, setSystemFieldKind] = useState<"created" | "updated">(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.kind ?? "created";
  });
  const [error, setError] = useState("");

  const isRelationType =
    fieldType === FieldType.RELATION || fieldType === FieldType.RELATION_SUBTABLE;
  const isRelationSubtableType = fieldType === FieldType.RELATION_SUBTABLE;
  const isPersistedField = Boolean(field?.id);
  const isSystemManagedInverse = Boolean(field?.isSystemManagedInverse);
  const isRelationTargetLocked = isPersistedField || isSystemManagedInverse;
  const isRelationSchemaLocked = isSystemManagedInverse;

  const selectedTableName =
    availableTables.find((table) => table.id === selectedTableId)?.name ?? "";

  const inverseFieldPreview = useMemo(() => {
    if (isSystemManagedInverse && field?.key) {
      return field.key;
    }

    return buildInverseFieldPreview(key);
  }, [field?.key, isSystemManagedInverse, key]);

  // Sync error when form opens/closes
  useEffect(() => {
    if (open) {
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!selectedTableId) {
      setRelationFields([]);
      return;
    }

    const localTable = availableTables.find((item) => item.id === selectedTableId);
    if (localTable?.fields?.length) {
      setRelationFields(localTable.fields);
      return;
    }

    let cancelled = false;
    setLoadingFields(true);
    fetch(`/api/data-tables/${selectedTableId}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;

        if (data.success && data.data?.fields) {
          setRelationFields(data.data.fields);
          return;
        }

        if (data.fields) {
          setRelationFields(data.fields);
          return;
        }

        setRelationFields([]);
      })
      .catch((fetchError) => {
        console.error("Failed to load table fields:", fetchError);
        if (!cancelled) {
          setRelationFields([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFields(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [availableTables, selectedTableId]);

  useEffect(() => {
    if (
      fieldType === FieldType.RELATION_SUBTABLE &&
      relationCardinality === "MULTIPLE" &&
      inverseRelationCardinality !== "MULTIPLE"
    ) {
      setInverseRelationCardinality("MULTIPLE");
    }
  }, [fieldType, inverseRelationCardinality, relationCardinality]);

  const updateRelationSchemaField = (
    index: number,
    patch: Partial<RelationSchemaFieldDraft>
  ) => {
    setRelationSchemaFields((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item
      )
    );
  };

  const addRelationSchemaField = () => {
    setRelationSchemaFields((current) => [...current, emptyRelationSchemaFieldDraft()]);
  };

  const removeRelationSchemaField = (index: number) => {
    setRelationSchemaFields((current) =>
      current.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const moveRelationSchemaField = (index: number, direction: -1 | 1) => {
    setRelationSchemaFields((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!key.trim()) {
      setError("字段标识不能为空");
      return;
    }

    if (!label.trim()) {
      setError("显示名称不能为空");
      return;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      setError("字段标识必须以小写字母开头，只能包含小写字母、数字和下划线");
      return;
    }

    // Uniqueness check for field key
    if (existingFieldKeys.includes(key.trim()) && key.trim() !== field?.key) {
      setError(`字段标识 "${key.trim()}" 已存在，请使用其他名称`);
      return;
    }

    if (isRelationSubtableType && !selectedTableId) {
      setError("请选择关联表");
      return;
    }

    if (isRelationSubtableType && hasDuplicateRelationSchemaKeys(relationSchemaFields)) {
      setError("边属性子字段标识不能重复");
      return;
    }

    let fieldOptions: DataFieldInput["options"] = undefined;
    if (fieldType === FieldType.SELECT || fieldType === FieldType.MULTISELECT) {
      fieldOptions = selectOptions.filter((o) => o.label.trim());
    } else if (fieldType === FieldType.FORMULA) {
      fieldOptions = { formula: formulaExpression.trim() };
    } else if (fieldType === FieldType.SYSTEM_TIMESTAMP || fieldType === FieldType.SYSTEM_USER) {
      fieldOptions = { kind: systemFieldKind };
    }

    const data: DataFieldInput = {
      id: field?.id,
      key: key.trim(),
      label: label.trim(),
      type: fieldType,
      required,
      defaultValue: defaultValue.trim() || undefined,
      sortOrder: field?.sortOrder ?? 0,
      options: fieldOptions,
      relationTo: isRelationType ? selectedTableId : undefined,
      displayField: isRelationType ? selectedDisplayField : undefined,
      relationCardinality: isRelationSubtableType ? relationCardinality : undefined,
      inverseRelationCardinality: isRelationSubtableType
        ? inverseRelationCardinality
        : undefined,
      relationSchema: isRelationSubtableType
        ? buildRelationSchemaPayload(relationSchemaFields)
        : undefined,
    };

    if (field?.inverseFieldId) {
      data.inverseFieldId = field.inverseFieldId;
    }

    if (field?.isSystemManagedInverse) {
      data.isSystemManagedInverse = true;
    }

    onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[560px] overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <SheetHeader>
            <SheetTitle>{field ? "编辑字段" : "添加字段"}</SheetTitle>
            <SheetDescription>配置字段属性，不同类型有不同的配置选项</SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0 px-4">
            <div className="grid gap-2">
              <Label htmlFor="key">
                字段标识 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="key"
                placeholder="例如：project_name"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                disabled={isPersistedField}
              />
              <p className="text-xs text-zinc-500">英文字母开头，仅支持小写字母、数字、下划线</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="label">
                显示名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="label"
                placeholder="例如：项目名称"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="field-type-select">字段类型</Label>
              <Select
                value={fieldType}
                onValueChange={(value) => setFieldType(value as FieldType)}
              >
                <SelectTrigger
                  id="field-type-select"
                >
                  <SelectValue placeholder="选择类型">
                    {getFieldTypeLabel(fieldType)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="required">是否必填</Label>
              <Switch id="required" checked={required} onCheckedChange={setRequired} />
            </div>

            {(fieldType === FieldType.SELECT || fieldType === FieldType.MULTISELECT) && (
              <div className="grid gap-2">
                <Label>选项列表</Label>
                <div className="space-y-2">
                  {selectOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        className="w-6 h-6 rounded-full border flex-shrink-0 relative group"
                        style={{ backgroundColor: opt.color }}
                        title="点击更换颜色"
                        onClick={() => {
                          const currentIdx = SELECT_COLORS.findIndex((c) => c.bg === opt.color);
                          const nextIdx = (currentIdx + 1) % SELECT_COLORS.length;
                          const updated = [...selectOptions];
                          updated[i] = { ...updated[i], color: SELECT_COLORS[nextIdx].bg };
                          setSelectOptions(updated);
                        }}
                      >
                        <span className="absolute inset-0 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          ↻
                        </span>
                      </button>
                      <Input
                        value={opt.label}
                        onChange={(e) => {
                          const updated = [...selectOptions];
                          updated[i] = { ...updated[i], label: e.target.value };
                          setSelectOptions(updated);
                        }}
                        className="h-8 text-sm flex-1"
                        placeholder={`选项 ${i + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setSelectOptions(selectOptions.filter((_, idx) => idx !== i))
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectOptions([
                        ...selectOptions,
                        {
                          label: "",
                          color: SELECT_COLORS[selectOptions.length % SELECT_COLORS.length].bg,
                        },
                      ])
                    }
                  >
                    + 添加选项
                  </Button>
                </div>
              </div>
            )}

            {fieldType === FieldType.FORMULA && (
              <div className="grid gap-2">
                <Label htmlFor="formula">公式表达式</Label>
                <Textarea
                  id="formula"
                  placeholder="例如：price * quantity&#10;支持：+ - * / () 及函数 SUM, AVG, MIN, MAX, IF 等"
                  value={formulaExpression}
                  onChange={(event) => setFormulaExpression(event.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-zinc-500">
                  使用其他字段标识作为变量，例如 <code className="bg-muted px-1 rounded">price * quantity</code>
                </p>
              </div>
            )}

            {(fieldType === FieldType.SYSTEM_TIMESTAMP || fieldType === FieldType.SYSTEM_USER) && (
              <div className="grid gap-2">
                <Label htmlFor="system-kind">记录类型</Label>
                <Select
                  value={systemFieldKind}
                  onValueChange={(value) => setSystemFieldKind(value as "created" | "updated")}
                >
                  <SelectTrigger id="system-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created">
                      {fieldType === FieldType.SYSTEM_TIMESTAMP ? "创建时间" : "创建人"}
                    </SelectItem>
                    <SelectItem value="updated">
                      {fieldType === FieldType.SYSTEM_TIMESTAMP ? "修改时间" : "修改人"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isRelationType && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="relation-table-select">关联到表</Label>
                  <Select
                    value={selectedTableId}
                    onValueChange={(value) => {
                      setSelectedTableId(value ?? "");
                      setSelectedDisplayField("");
                    }}
                  >
                    <SelectTrigger
                      id="relation-table-select"
                      disabled={isRelationTargetLocked}
                    >
                      <SelectValue placeholder="选择关联表">
                        {selectedTableId ? selectedTableName || "选择关联表" : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedTableId && (
                  <div className="grid gap-2">
                    <Label htmlFor="relation-display-field-select">显示字段</Label>
                    <Select
                      value={selectedDisplayField}
                      onValueChange={(value) => setSelectedDisplayField(value ?? "")}
                    >
                      <SelectTrigger
                        id="relation-display-field-select"
                        disabled={isSystemManagedInverse}
                      >
                        <SelectValue
                          placeholder={loadingFields ? "加载中..." : "选择显示字段"}
                        >
                          {selectedDisplayField
                            ? relationFields.find((item) => item.key === selectedDisplayField)
                                ?.label ?? selectedDisplayField
                            : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {relationFields.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            {loadingFields ? "加载中..." : "暂无字段"}
                          </div>
                        ) : (
                          relationFields.map((item) => (
                            <SelectItem key={item.id} value={item.key}>
                              {item.label} ({item.key})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {fieldType === FieldType.RELATION_SUBTABLE && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="relation-cardinality-select">本侧基数</Label>
                      <Select
                        value={relationCardinality}
                        onValueChange={(value) => {
                          const nextValue = value as RelationCardinality;
                          setRelationCardinality(nextValue);
                          if (nextValue === "MULTIPLE") {
                            setInverseRelationCardinality("MULTIPLE");
                          } else if (!isSystemManagedInverse && inverseRelationCardinality !== "SINGLE") {
                            setInverseRelationCardinality("SINGLE");
                          }
                        }}
                      >
                        <SelectTrigger
                          id="relation-cardinality-select"
                          disabled={isRelationTargetLocked}
                        >
                          <SelectValue>{relationCardinality}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SINGLE">SINGLE</SelectItem>
                          <SelectItem value="MULTIPLE">MULTIPLE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="inverse-relation-cardinality-select">反向侧基数</Label>
                      <Select
                        value={inverseRelationCardinality}
                        onValueChange={(value) =>
                          setInverseRelationCardinality(value as RelationCardinality)
                        }
                      >
                        <SelectTrigger
                          id="inverse-relation-cardinality-select"
                          disabled={isRelationTargetLocked}
                        >
                          <SelectValue>{inverseRelationCardinality}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SINGLE">SINGLE</SelectItem>
                          <SelectItem value="MULTIPLE">MULTIPLE</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-zinc-500">
                        {relationCardinality === "MULTIPLE"
                          ? "本侧为 MULTIPLE 时，反向侧固定为 MULTIPLE"
                          : "本侧为 SINGLE 时，反向侧可选择 SINGLE 或 MULTIPLE"}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="inverse-field-preview">反向字段默认命名预览</Label>
                      <Input id="inverse-field-preview" value={inverseFieldPreview} readOnly />
                    </div>

                    <div className="rounded-md border p-3" data-testid="relation-schema-editor">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">边属性</p>
                          <p className="text-xs text-zinc-500">编辑 relationSchema.version = 1 的子字段</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addRelationSchemaField}
                          disabled={isRelationSchemaLocked}
                        >
                          添加边属性
                        </Button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {relationSchemaFields.length === 0 ? (
                          <p className="text-sm text-zinc-500">
                            暂无边属性，点击「添加边属性」开始配置
                          </p>
                        ) : (
                          relationSchemaFields.map((schemaField, index) => {
                            const keyId = `relation-schema-key-${index}`;
                            const labelId = `relation-schema-label-${index}`;
                            const typeId = `relation-schema-type-${index}`;
                            const optionsId = `relation-schema-options-${index}`;

                            return (
                              <div key={`${schemaField.key}-${index}`} className="rounded-md border p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">子字段 {index + 1}</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeRelationSchemaField(index)}
                                    disabled={isRelationSchemaLocked}
                                  >
                                    删除
                                  </Button>
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => moveRelationSchemaField(index, -1)}
                                      disabled={isRelationSchemaLocked || index === 0}
                                    >
                                      上移
                                    </Button>
                                      <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => moveRelationSchemaField(index, 1)}
                                      disabled={
                                        isRelationSchemaLocked ||
                                        index === relationSchemaFields.length - 1
                                      }
                                    >
                                      下移
                                    </Button>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-3">
                                  <div className="grid gap-2">
                                    <Label htmlFor={keyId}>子字段标识</Label>
                                      <Input
                                        id={keyId}
                                        value={schemaField.key}
                                        onChange={(event) =>
                                          updateRelationSchemaField(index, { key: event.target.value })
                                        }
                                      disabled={isRelationSchemaLocked}
                                      />
                                  </div>

                                  <div className="grid gap-2">
                                    <Label htmlFor={labelId}>子字段名称</Label>
                                      <Input
                                        id={labelId}
                                        value={schemaField.label}
                                        onChange={(event) =>
                                          updateRelationSchemaField(index, { label: event.target.value })
                                        }
                                      disabled={isRelationSchemaLocked}
                                      />
                                  </div>

                                  <div className="grid gap-2">
                                    <Label htmlFor={typeId}>子字段类型</Label>
                                    <Select
                                      value={schemaField.type}
                                      onValueChange={(value) =>
                                        updateRelationSchemaField(index, {
                                          type: value as RelationSchemaFieldDraft["type"],
                                        })
                                      }
                                    >
                                      <SelectTrigger
                                        id={typeId}
                                        disabled={isRelationSchemaLocked}
                                      >
                                        <SelectValue>{getFieldTypeLabel(schemaField.type)}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {RELATION_SCHEMA_FIELD_TYPES.map((item) => (
                                          <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <Label htmlFor={`relation-schema-required-${index}`}>是否必填</Label>
                                      <Switch
                                        checked={schemaField.required}
                                        onCheckedChange={(checked) =>
                                          updateRelationSchemaField(index, { required: checked })
                                        }
                                      disabled={isRelationSchemaLocked}
                                      />
                                  </div>

                                  {(schemaField.type === FieldType.SELECT ||
                                    schemaField.type === FieldType.MULTISELECT) && (
                                    <div className="grid gap-2">
                                      <Label htmlFor={optionsId}>子字段选项</Label>
                                      <Textarea
                                        id={optionsId}
                                        value={schemaField.optionsText}
                                        onChange={(event) =>
                                          updateRelationSchemaField(index, {
                                            optionsText: event.target.value,
                                          })
                                        }
                                        rows={3}
                                        disabled={isRelationSchemaLocked}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="defaultValue">默认值</Label>
              <Input
                id="defaultValue"
                placeholder="可选"
                value={defaultValue}
                onChange={(event) => setDefaultValue(event.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <SheetFooter className="flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

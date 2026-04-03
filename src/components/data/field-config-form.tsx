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
} from "@/types/data-table";
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

export function FieldConfigForm({
  open,
  onOpenChange,
  field,
  availableTables,
  onSubmit,
}: FieldConfigFormProps) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>(FieldType.TEXT);
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedDisplayField, setSelectedDisplayField] = useState("");
  const [relationCardinality, setRelationCardinality] =
    useState<RelationCardinality>("SINGLE");
  const [inverseRelationCardinality, setInverseRelationCardinality] =
    useState<RelationCardinality>("SINGLE");
  const [relationSchemaFields, setRelationSchemaFields] = useState<
    RelationSchemaFieldDraft[]
  >([]);
  const [relationFields, setRelationFields] = useState<DataFieldItem[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState("");

  const isRelationType =
    fieldType === FieldType.RELATION || fieldType === FieldType.RELATION_SUBTABLE;
  const isRelationSubtableType = fieldType === FieldType.RELATION_SUBTABLE;
  const isSystemManagedInverse = Boolean(field?.isSystemManagedInverse);

  const selectedTableName =
    availableTables.find((table) => table.id === selectedTableId)?.name ?? "";

  const inverseFieldPreview = useMemo(() => {
    if (isSystemManagedInverse && field?.key) {
      return field.key;
    }

    return buildInverseFieldPreview(key);
  }, [field?.key, isSystemManagedInverse, key]);

  useEffect(() => {
    if (!open) return;

    const nextFieldType = field?.type ?? FieldType.TEXT;
    const nextRelationCardinality = field?.relationCardinality ?? "SINGLE";
    const nextInverseRelationCardinality =
      field?.inverseRelationCardinality ??
      (nextRelationCardinality === "MULTIPLE" ? "MULTIPLE" : "SINGLE");

    setKey(field?.key ?? "");
    setLabel(field?.label ?? "");
    setFieldType(nextFieldType);
    setRequired(field?.required ?? false);
    setDefaultValue(field?.defaultValue ?? "");
    setOptionsText(field?.options?.join("\n") ?? "");
    setSelectedTableId(field?.relationTo ?? "");
    setSelectedDisplayField(field?.displayField ?? "");
    setRelationCardinality(nextRelationCardinality);
    setInverseRelationCardinality(nextInverseRelationCardinality);
    setRelationSchemaFields(buildRelationSchemaDraft(field?.relationSchema?.fields));
    setError("");

    if (field?.relationTo) {
      const table = availableTables.find((item) => item.id === field.relationTo);
      if (table?.fields?.length) {
        setRelationFields(table.fields);
      } else {
        setRelationFields([]);
      }
    } else {
      setRelationFields([]);
    }
  }, [availableTables, field, open]);

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

    if (isRelationSubtableType && !selectedTableId) {
      setError("请选择关联表");
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
              .map((item) => item.trim())
              .filter(Boolean)
          : undefined,
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

  const canEditRelationCardinality = !isSystemManagedInverse;
  const canEditInverseRelationCardinality =
    !isSystemManagedInverse && relationCardinality !== "MULTIPLE";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>{field ? "编辑字段" : "添加字段"}</SheetTitle>
            <SheetDescription>配置字段属性，不同类型有不同的配置选项</SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key">
                字段标识 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="key"
                placeholder="例如：project_name"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                disabled={Boolean(field && isSystemManagedInverse)}
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
                  disabled={Boolean(field && isSystemManagedInverse)}
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
              <Switch checked={required} onCheckedChange={setRequired} />
            </div>

            {(fieldType === FieldType.SELECT || fieldType === FieldType.MULTISELECT) && (
              <div className="grid gap-2">
                <Label htmlFor="options">选项列表</Label>
                <Textarea
                  id="options"
                  placeholder="每行一个选项，例如：&#10;进行中&#10;已完成&#10;已取消"
                  value={optionsText}
                  onChange={(event) => setOptionsText(event.target.value)}
                  rows={4}
                />
                <p className="text-xs text-zinc-500">每行一个选项值</p>
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
                      disabled={Boolean(field && isSystemManagedInverse)}
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
                        disabled={Boolean(field && isSystemManagedInverse)}
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
                          disabled={!canEditRelationCardinality}
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
                          disabled={!canEditInverseRelationCardinality}
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
                          disabled={Boolean(field && isSystemManagedInverse)}
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
                                    disabled={Boolean(field && isSystemManagedInverse)}
                                  >
                                    删除
                                  </Button>
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
                                      disabled={Boolean(field && isSystemManagedInverse)}
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
                                      disabled={Boolean(field && isSystemManagedInverse)}
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
                                        disabled={Boolean(field && isSystemManagedInverse)}
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
                                      disabled={Boolean(field && isSystemManagedInverse)}
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
                                        disabled={Boolean(field && isSystemManagedInverse)}
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

          <SheetFooter>
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

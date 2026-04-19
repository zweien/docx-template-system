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
import type { RollupAggregateType, FilterCondition, FilterGroup } from "@/types/data-table";
import type { DataFieldInput } from "@/validators/data-table";
import { FormulaEditor } from "@/components/data/formula-editor";
import { parseFormula, evaluateFormula, detectCircularRefs } from "@/lib/formula";
import { FieldTypeIcon } from "./field-type-icon";

interface FieldConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: DataFieldItem | null;
  fields?: DataFieldItem[];
  tableId?: string;
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
  { value: FieldType.COUNT, label: "计数" },
  { value: FieldType.LOOKUP, label: "查找" },
  { value: FieldType.ROLLUP, label: "汇总" },
  { value: FieldType.RICH_TEXT, label: "富文本" },
  { value: FieldType.RATING, label: "评分" },
  { value: FieldType.CURRENCY, label: "货币" },
  { value: FieldType.PERCENTAGE, label: "百分比" },
  { value: FieldType.DURATION, label: "时长" },
  { value: FieldType.RELATION, label: "关联字段" },
  { value: FieldType.RELATION_SUBTABLE, label: "关系子表格" },
];

const RELATION_SCHEMA_FIELD_TYPES = FIELD_TYPES.filter(
  (item) => item.value !== FieldType.RELATION && item.value !== FieldType.RELATION_SUBTABLE
);

const ROLLUP_CONDITION_OPERATOR_OPTIONS = [
  { value: "eq", label: "等于" }, { value: "ne", label: "不等于" },
  { value: "contains", label: "包含" }, { value: "notcontains", label: "不包含" },
  { value: "startswith", label: "开头是" }, { value: "endswith", label: "结尾是" },
  { value: "isempty", label: "为空" }, { value: "isnotempty", label: "不为空" },
  { value: "gt", label: "大于" }, { value: "lt", label: "小于" },
  { value: "gte", label: "大于等于" }, { value: "lte", label: "小于等于" },
  { value: "between", label: "范围" },
  { value: "in", label: "属于" }, { value: "notin", label: "不属于" },
];

const NO_VALUE_OPS = ["isempty", "isnotempty"];

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

function getAvailableRollupAggregates(targetFieldType: FieldType): { value: RollupAggregateType; label: string }[] {
  switch (targetFieldType) {
    case FieldType.NUMBER:
    case FieldType.RATING:
    case FieldType.CURRENCY:
    case FieldType.PERCENTAGE:
    case FieldType.DURATION:
      return [
        { value: "SUM", label: "求和 (SUM)" },
        { value: "AVG", label: "平均值 (AVG)" },
        { value: "MIN", label: "最小值 (MIN)" },
        { value: "MAX", label: "最大值 (MAX)" },
        { value: "COUNT", label: "计数 (COUNT)" },
        { value: "COUNTA", label: "非空计数 (COUNTA)" },
      ];
    case FieldType.TEXT:
    case FieldType.EMAIL:
    case FieldType.PHONE:
    case FieldType.URL:
      return [
        { value: "COUNT", label: "计数 (COUNT)" },
        { value: "COUNTA", label: "非空计数 (COUNTA)" },
        { value: "ARRAYJOIN", label: "连接 (ARRAYJOIN)" },
        { value: "ARRAYUNIQUE", label: "去重连接 (ARRAYUNIQUE)" },
      ];
    case FieldType.DATE:
    case FieldType.SYSTEM_TIMESTAMP:
      return [
        { value: "MIN", label: "最早 (MIN)" },
        { value: "MAX", label: "最晚 (MAX)" },
        { value: "COUNT", label: "计数 (COUNT)" },
      ];
    case FieldType.BOOLEAN:
      return [
        { value: "COUNT", label: "计数 (COUNT)" },
        { value: "TRUE_COUNT", label: "真值计数 (TRUE_COUNT)" },
        { value: "FALSE_COUNT", label: "假值计数 (FALSE_COUNT)" },
      ];
    default:
      return [
        { value: "COUNT", label: "计数 (COUNT)" },
        { value: "COUNTA", label: "非空计数 (COUNTA)" },
      ];
  }
}

export function FieldConfigForm({
  open,
  onOpenChange,
  field,
  fields: allFields = [],
  tableId,
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
  const [countSourceFieldId, setCountSourceFieldId] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.countSourceFieldId ?? "";
  });
  const [lookupSourceFieldId, setLookupSourceFieldId] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.lookupSourceFieldId ?? "";
  });
  const [lookupTargetFieldKey, setLookupTargetFieldKey] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.lookupTargetFieldKey ?? "";
  });
  const [lookupTargetFields, setLookupTargetFields] = useState<DataFieldItem[]>(() => {
    if (field?.relationTo) {
      const table = availableTables.find((item) => item.id === field.relationTo);
      return table?.fields ?? [];
    }
    return [];
  });

  // ROLLUP state
  const [rollupSourceFieldId, setRollupSourceFieldId] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.rollupSourceFieldId ?? "";
  });
  const [rollupTargetFieldKey, setRollupTargetFieldKey] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.rollupTargetFieldKey ?? "";
  });
  const [rollupAggregateType, setRollupAggregateType] = useState<RollupAggregateType | "">(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.rollupAggregateType as RollupAggregateType) ?? "";
  });
  const [rollupTargetFields, setRollupTargetFields] = useState<DataFieldItem[]>([]);
  const [rollupConditions, setRollupConditions] = useState<FilterGroup[]>(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.rollupConditions as FilterGroup[]) ?? [];
  });

  // RATING / CURRENCY / PERCENTAGE / DURATION state
  const [ratingMax, setRatingMax] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.ratingMax as number) ?? 5;
  });
  const [ratingAllowHalf, setRatingAllowHalf] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.ratingAllowHalf as boolean) ?? false;
  });
  const [currencyCode, setCurrencyCode] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.currencyCode as string) ?? "CNY";
  });
  const [currencyDecimals, setCurrencyDecimals] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.currencyDecimals as number) ?? 2;
  });
  const [percentageDecimals, setPercentageDecimals] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.percentageDecimals as number) ?? 0;
  });
  const [durationFormat, setDurationFormat] = useState(() => {
    const opts = parseFieldOptions(field?.options);
    return (opts.durationFormat as string) ?? "hh:mm";
  });
  const [systemFieldKind, setSystemFieldKind] = useState<"created" | "updated">(() => {
    const opts = parseFieldOptions(field?.options);
    return opts.kind ?? "created";
  });
  const [error, setError] = useState("");

  // Load target table fields when lookup source field changes
  useEffect(() => {
    if (!lookupSourceFieldId) {
      setLookupTargetFields([]);
      return;
    }
    const sourceField = allFields.find((f) => f.id === lookupSourceFieldId);
    if (!sourceField?.relationTo) {
      setLookupTargetFields([]);
      return;
    }

    // Check if we already have fields from availableTables
    const localTable = availableTables.find((t) => t.id === sourceField.relationTo);
    if (localTable?.fields?.length) {
      setLookupTargetFields(localTable.fields);
      return;
    }

    let cancelled = false;
    fetch(`/api/data-tables/${sourceField.relationTo}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const fields = data.data?.fields ?? data.fields ?? [];
        setLookupTargetFields(fields);
      })
      .catch(() => {
        if (!cancelled) setLookupTargetFields([]);
      });

    return () => { cancelled = true; };
  }, [lookupSourceFieldId, allFields, availableTables]);

  // Load target table fields when rollup source field changes
  useEffect(() => {
    if (!rollupSourceFieldId) {
      setRollupTargetFields([]);
      return;
    }
    const sourceField = allFields.find((f) => f.id === rollupSourceFieldId);
    if (!sourceField?.relationTo) {
      setRollupTargetFields([]);
      return;
    }
    const localTable = availableTables.find((t) => t.id === sourceField.relationTo);
    if (localTable?.fields?.length) {
      setRollupTargetFields(localTable.fields);
      return;
    }
    let cancelled = false;
    fetch(`/api/data-tables/${sourceField.relationTo}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const fields = data.data?.fields ?? data.fields ?? [];
        setRollupTargetFields(fields);
      })
      .catch(() => {
        if (!cancelled) setRollupTargetFields([]);
      });
    return () => { cancelled = true; };
  }, [rollupSourceFieldId, allFields, availableTables]);

  // Formula validation
  const formulaError = useMemo(() => {
    const expr = formulaExpression.trim();
    if (!expr) return null;
    try {
      parseFormula(expr);
    } catch (e) {
      return e instanceof Error ? e.message : "公式语法错误";
    }
    // Circular reference check
    if (allFields.length > 0 && field?.key) {
      const formulaMap: Record<string, string> = {};
      for (const f of allFields) {
        if (f.type === "FORMULA") {
          const opts = parseFieldOptions(f.options);
          if (opts.formula) formulaMap[f.key] = opts.formula;
        }
      }
      formulaMap[field.key] = expr;
      const cycle = detectCircularRefs(formulaMap);
      if (cycle) return cycle;
    }
    return null;
  }, [formulaExpression, allFields, field]);

  // Live preview: fetch sample record once when form opens
  const [sampleData, setSampleData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!open || fieldType !== FieldType.FORMULA || !tableId) return;
    let cancelled = false;
    fetch(`/api/data-tables/${tableId}/records?pageSize=1`)
      .then((res) => res.json())
      .then((result) => {
        if (cancelled) return;
        if (result.records?.[0]?.data) {
          setSampleData(result.records[0].data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, fieldType, tableId]);

  // Reset all state when field prop changes (edit vs create)
  useEffect(() => {
    const opts = parseFieldOptions(field?.options);
    setKey(field?.key ?? "");
    setLabel(field?.label ?? "");
    setFieldType(field?.type ?? FieldType.TEXT);
    setRequired(field?.required ?? false);
    setDefaultValue(field?.defaultValue ?? "");
    setSelectOptions(parseSelectOptions(field?.options));
    setSelectedTableId(field?.relationTo ?? "");
    setSelectedDisplayField(field?.displayField ?? "");
    setRelationCardinality(field?.relationCardinality ?? "SINGLE");
    setInverseRelationCardinality(
      field?.inverseRelationCardinality ??
        (field?.relationCardinality === "MULTIPLE" ? "MULTIPLE" : "SINGLE")
    );
    setRelationSchemaFields(buildRelationSchemaDraft(field?.relationSchema?.fields));
    const relTable = field?.relationTo
      ? availableTables.find((t) => t.id === field.relationTo)
      : undefined;
    setRelationFields(relTable?.fields ?? []);
    setFormulaExpression(opts.formula ?? "");
    setCountSourceFieldId(opts.countSourceFieldId ?? "");
    setLookupSourceFieldId(opts.lookupSourceFieldId ?? "");
    setLookupTargetFieldKey(opts.lookupTargetFieldKey ?? "");
    setRollupSourceFieldId(opts.rollupSourceFieldId ?? "");
    setRollupTargetFieldKey(opts.rollupTargetFieldKey ?? "");
    setRollupAggregateType((opts.rollupAggregateType as RollupAggregateType) ?? "");
    setRollupConditions((opts.rollupConditions as FilterGroup[]) ?? []);
    setRatingMax((opts.ratingMax as number) ?? 5);
    setRatingAllowHalf((opts.ratingAllowHalf as boolean) ?? false);
    setCurrencyCode((opts.currencyCode as string) ?? "CNY");
    setCurrencyDecimals((opts.currencyDecimals as number) ?? 2);
    setPercentageDecimals((opts.percentageDecimals as number) ?? 0);
    setDurationFormat((opts.durationFormat as string) ?? "hh:mm");
    setSystemFieldKind(opts.kind ?? "created");
    setError("");
  }, [field, availableTables]);

  const formulaPreview = useMemo(() => {
    const expr = formulaExpression.trim();
    if (!expr || formulaError || !sampleData) return undefined;
    try {
      return evaluateFormula(expr, sampleData);
    } catch {
      return undefined;
    }
  }, [formulaExpression, formulaError, sampleData]);

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

    if (fieldType === FieldType.COUNT && !countSourceFieldId) {
      setError("请选择要计数的关联字段");
      return;
    }

    if (fieldType === FieldType.LOOKUP && !lookupSourceFieldId) {
      setError("请选择源关联字段");
      return;
    }
    if (fieldType === FieldType.LOOKUP && !lookupTargetFieldKey) {
      setError("请选择要拉取的字段");
      return;
    }
    if (fieldType === FieldType.ROLLUP && !rollupSourceFieldId) {
      setError("请选择源关联字段");
      return;
    }
    if (fieldType === FieldType.ROLLUP && !rollupTargetFieldKey) {
      setError("请选择要汇总的字段");
      return;
    }
    if (fieldType === FieldType.ROLLUP && !rollupAggregateType) {
      setError("请选择聚合方式");
      return;
    }

    let fieldOptions: DataFieldInput["options"] = undefined;
    if (fieldType === FieldType.SELECT || fieldType === FieldType.MULTISELECT) {
      fieldOptions = selectOptions.filter((o) => o.label.trim());
    } else if (fieldType === FieldType.FORMULA) {
      fieldOptions = { formula: formulaExpression.trim() };
    } else if (fieldType === FieldType.COUNT) {
      fieldOptions = { countSourceFieldId };
    } else if (fieldType === FieldType.LOOKUP) {
      fieldOptions = { lookupSourceFieldId, lookupTargetFieldKey };
    } else if (fieldType === FieldType.ROLLUP) {
      const srcField = allFields.find((f) => f.id === rollupSourceFieldId);
      const hasConditions = srcField?.type === "RELATION_SUBTABLE" && rollupConditions.some((g) => g.conditions.length > 0);
      fieldOptions = hasConditions
        ? { rollupSourceFieldId, rollupTargetFieldKey, rollupAggregateType: rollupAggregateType as RollupAggregateType, rollupConditions: rollupConditions.filter((g) => g.conditions.length > 0) }
        : { rollupSourceFieldId, rollupTargetFieldKey, rollupAggregateType: rollupAggregateType as RollupAggregateType };
    } else if (fieldType === FieldType.SYSTEM_TIMESTAMP || fieldType === FieldType.SYSTEM_USER) {
      fieldOptions = { kind: systemFieldKind };
    } else if (fieldType === FieldType.RATING) {
      fieldOptions = { ratingMax, ratingAllowHalf } as DataFieldInput["options"];
    } else if (fieldType === FieldType.CURRENCY) {
      fieldOptions = { currencyCode, currencyDecimals } as DataFieldInput["options"];
    } else if (fieldType === FieldType.PERCENTAGE) {
      fieldOptions = { percentageDecimals } as DataFieldInput["options"];
    } else if (fieldType === FieldType.DURATION) {
      fieldOptions = { durationFormat } as DataFieldInput["options"];
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
                      <span className="inline-flex items-center gap-1.5">
                        <FieldTypeIcon type={item.value} />
                        {item.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fieldType !== FieldType.COUNT && fieldType !== FieldType.LOOKUP &&
              fieldType !== FieldType.ROLLUP &&
              fieldType !== FieldType.FORMULA &&
              fieldType !== FieldType.AUTO_NUMBER && fieldType !== FieldType.SYSTEM_TIMESTAMP &&
              fieldType !== FieldType.SYSTEM_USER && (
              <div className="flex items-center justify-between">
                <Label htmlFor="required">是否必填</Label>
                <Switch id="required" checked={required} onCheckedChange={setRequired} />
              </div>
            )}

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
                <Label>公式表达式</Label>
                <FormulaEditor
                  initialValue={formulaExpression}
                  fields={allFields}
                  onChange={setFormulaExpression}
                  error={formulaError}
                  livePreview={formulaPreview}
                />
              </div>
            )}

            {fieldType === FieldType.COUNT && (
              <div className="grid gap-2">
                <Label>计数字段</Label>
                {allFields.filter(
                  (f) => f.type === FieldType.RELATION || f.type === FieldType.RELATION_SUBTABLE
                ).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    当前表没有关联字段，无法创建计数字段
                  </p>
                ) : (
                  <Select
                    value={countSourceFieldId}
                    onValueChange={(value) => setCountSourceFieldId(value ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择要计数的关联字段">
                        {countSourceFieldId
                          ? allFields.find((f) => f.id === countSourceFieldId)?.label ??
                            countSourceFieldId
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {allFields
                        .filter((f) => f.type === FieldType.RELATION || f.type === FieldType.RELATION_SUBTABLE)
                        .map((f) => (
                          <SelectItem key={f.id} value={f.id!}>
                            {f.label}
                            {f.type === FieldType.RELATION && "（单值关联，结果为 0 或 1）"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  自动统计关联记录数量，当关联记录增删时自动更新
                </p>
              </div>
            )}

            {fieldType === FieldType.LOOKUP && (
              <div className="grid gap-2">
                <Label>源关联字段</Label>
                {allFields.filter(
                  (f) => f.type === FieldType.RELATION || f.type === FieldType.RELATION_SUBTABLE
                ).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    当前表没有关联字段，无法创建查找字段
                  </p>
                ) : (
                  <Select
                    value={lookupSourceFieldId}
                    onValueChange={(value) => {
                      setLookupSourceFieldId(value ?? "");
                      setLookupTargetFieldKey("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择源关联字段">
                        {lookupSourceFieldId
                          ? allFields.find((f) => f.id === lookupSourceFieldId)?.label ??
                            lookupSourceFieldId
                          : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {allFields
                        .filter((f) => f.type === FieldType.RELATION || f.type === FieldType.RELATION_SUBTABLE)
                        .map((f) => (
                          <SelectItem key={f.id} value={f.id!}>
                            {f.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                {lookupSourceFieldId && (() => {
                  const sourceField = allFields.find((f) => f.id === lookupSourceFieldId);
                  if (!sourceField?.relationTo) return null;
                  const targetTableFields = lookupTargetFields.filter(
                    (f) =>
                      f.type !== FieldType.RELATION &&
                      f.type !== FieldType.RELATION_SUBTABLE &&
                      f.type !== FieldType.COUNT &&
                      f.type !== FieldType.LOOKUP &&
                      f.type !== FieldType.FORMULA
                  );
                  if (targetTableFields.length === 0) return null;
                  return (
                    <>
                      <Label>拉取字段</Label>
                      <Select
                        value={lookupTargetFieldKey}
                        onValueChange={(value) => setLookupTargetFieldKey(value ?? "")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择要拉取的字段">
                            {lookupTargetFieldKey
                              ? targetTableFields.find((f) => f.key === lookupTargetFieldKey)?.label ??
                                lookupTargetFieldKey
                              : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {targetTableFields.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  );
                })()}

                <p className="text-xs text-muted-foreground">
                  从关联记录拉取指定字段值，只读展示
                </p>
              </div>
            )}

            {fieldType === FieldType.ROLLUP && (
              <div className="grid gap-2">
                <Label>源关联字段</Label>
                <Select value={rollupSourceFieldId} onValueChange={(value) => {
                  setRollupSourceFieldId(value ?? "");
                  setRollupTargetFieldKey("");
                  setRollupAggregateType("");
                  setRollupConditions([]);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择源关联字段">
                      {rollupSourceFieldId
                        ? allFields.find((f) => f.id === rollupSourceFieldId)?.label ?? rollupSourceFieldId
                        : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {allFields
                      .filter((f) => f.type === FieldType.RELATION || f.type === FieldType.RELATION_SUBTABLE)
                      .map((f) => (
                        <SelectItem key={f.id!} value={f.id!}>
                          {f.label}
                          {f.type === FieldType.RELATION && "（单值关联，直接取值）"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {rollupSourceFieldId && (() => {
                  const sourceField = allFields.find((f) => f.id === rollupSourceFieldId);
                  if (!sourceField?.relationTo) return null;
                  const targetFields = rollupTargetFields.filter(
                    (f) =>
                      f.type !== FieldType.RELATION &&
                      f.type !== FieldType.RELATION_SUBTABLE &&
                      f.type !== FieldType.COUNT &&
                      f.type !== FieldType.LOOKUP &&
                      f.type !== FieldType.FORMULA &&
                      f.type !== FieldType.ROLLUP
                  );
                  return (
                    <>
                      <Label>汇总字段</Label>
                      <Select value={rollupTargetFieldKey} onValueChange={(value) => {
                        setRollupTargetFieldKey(value ?? "");
                        setRollupAggregateType("");
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择要汇总的字段">
                            {rollupTargetFieldKey
                              ? targetFields.find((f) => f.key === rollupTargetFieldKey)?.label ?? rollupTargetFieldKey
                              : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {targetFields.map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label} ({f.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  );
                })()}

                {rollupTargetFieldKey && (() => {
                  const targetField = rollupTargetFields.find((f) => f.key === rollupTargetFieldKey);
                  if (!targetField) return null;
                  const aggs = getAvailableRollupAggregates(targetField.type as FieldType);
                  return (
                    <>
                      <Label>聚合方式</Label>
                      <Select value={rollupAggregateType} onValueChange={(v) => setRollupAggregateType(v as RollupAggregateType)}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择聚合方式" />
                        </SelectTrigger>
                        <SelectContent>
                          {aggs.map((agg) => (
                            <SelectItem key={agg.value} value={agg.value}>
                              {agg.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  );
                })()}

                {/* Rollup filter conditions — only for RELATION_SUBTABLE source */}
                {rollupSourceFieldId && allFields.find((f) => f.id === rollupSourceFieldId)?.type === "RELATION_SUBTABLE" && (() => {
                  const condTargetFields = rollupTargetFields.filter(
                    (f) =>
                      f.type !== "RELATION" &&
                      f.type !== "RELATION_SUBTABLE" &&
                      f.type !== "COUNT" &&
                      f.type !== "LOOKUP" &&
                      f.type !== "FORMULA" &&
                      f.type !== "ROLLUP"
                  );

                  if (condTargetFields.length === 0) return null;
                  return (
                    <>
                      <Label>筛选条件（可选）</Label>
                      <p className="text-xs text-muted-foreground -mt-1">仅汇总满足条件的关联记录</p>
                      {rollupConditions.map((group, gi) => (
                        <div key={gi} className="border rounded-md p-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">条件组 {gi + 1}</span>
                              <Select
                                value={group.operator}
                                onValueChange={(v) => {
                                  const updated = [...rollupConditions];
                                  updated[gi] = { ...updated[gi], operator: (v ?? "AND") as "AND" | "OR" };
                                  setRollupConditions(updated);
                                }}
                              >
                                <SelectTrigger className="h-7 w-[80px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AND">AND</SelectItem>
                                  <SelectItem value="OR">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {rollupConditions.length > 1 && (
                              <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => {
                                setRollupConditions(rollupConditions.filter((_, i) => i !== gi));
                              }}>
                                删除组
                              </Button>
                            )}
                          </div>
                          {group.conditions.map((cond, ci) => (
                            <div key={ci} className="flex items-center gap-1">
                              <Select value={cond.fieldKey} onValueChange={(v) => {
                                const updated = [...rollupConditions];
                                const conds = [...updated[gi].conditions];
                                conds[ci] = { ...conds[ci], fieldKey: v ?? "" };
                                updated[gi] = { ...updated[gi], conditions: conds };
                                setRollupConditions(updated);
                              }}>
                                <SelectTrigger className="h-7 flex-1 text-xs">
                                  <SelectValue placeholder="选择字段" />
                                </SelectTrigger>
                                <SelectContent>
                                  {condTargetFields.map((f) => (
                                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={cond.op} onValueChange={(v) => {
                                const updated = [...rollupConditions];
                                const conds = [...updated[gi].conditions];
                                conds[ci] = { ...conds[ci], op: (v ?? "eq") as FilterCondition["op"] };
                                updated[gi] = { ...updated[gi], conditions: conds };
                                setRollupConditions(updated);
                              }}>
                                <SelectTrigger className="h-7 w-[100px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLLUP_CONDITION_OPERATOR_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!NO_VALUE_OPS.includes(cond.op) && (
                                <Input
                                  className="h-7 flex-1 text-xs"
                                  value={
                                    cond.op === "between"
                                      ? `${(cond.value as { min: unknown; max: unknown }).min ?? ""}-${(cond.value as { min: unknown; max: unknown }).max ?? ""}`
                                      : Array.isArray(cond.value)
                                        ? cond.value.join(",")
                                        : String(cond.value ?? "")
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    let newVal: string | number | (string | number)[] | { min: string | number; max: string | number };
                                    if (cond.op === "between") {
                                      const parts = raw.split("-").map((s) => s.trim());
                                      newVal = { min: parts[0] ?? "", max: parts[1] ?? "" };
                                    } else if (cond.op === "in" || cond.op === "notin") {
                                      newVal = raw.split(",").map((s) => s.trim()).filter(Boolean);
                                    } else {
                                      newVal = raw;
                                    }
                                    const updated = [...rollupConditions];
                                    const conds = [...updated[gi].conditions];
                                    conds[ci] = { ...conds[ci], value: newVal };
                                    updated[gi] = { ...updated[gi], conditions: conds };
                                    setRollupConditions(updated);
                                  }}
                                  placeholder={
                                    cond.op === "between" ? "最小值-最大值"
                                      : cond.op === "in" || cond.op === "notin" ? "逗号分隔"
                                      : "值"
                                  }
                                />
                              )}
                              <Button variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={() => {
                                const updated = [...rollupConditions];
                                const conds = updated[gi].conditions.filter((_, i) => i !== ci);
                                updated[gi] = { ...updated[gi], conditions: conds };
                                setRollupConditions(updated);
                              }}>
                                ×
                              </Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                            const updated = [...rollupConditions];
                            updated[gi] = {
                              ...updated[gi],
                              conditions: [...updated[gi].conditions, { fieldKey: condTargetFields[0]?.key ?? "", op: "eq" as const, value: "" }],
                            };
                            setRollupConditions(updated);
                          }}>
                            + 添加条件
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                        setRollupConditions([...rollupConditions, {
                          operator: "AND" as const,
                          conditions: [{ fieldKey: condTargetFields[0]?.key ?? "", op: "eq" as const, value: "" }],
                        }]);
                      }}>
                        + 添加条件组
                      </Button>
                    </>
                  );
                })()}

                <p className="text-xs text-muted-foreground">
                  从关联记录聚合指定字段值，只读展示
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

            {fieldType === FieldType.RATING && (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="rating-max">最大星数</Label>
                  <Input
                    id="rating-max"
                    type="number"
                    min={1}
                    max={10}
                    value={ratingMax}
                    onChange={(e) => setRatingMax(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="rating-half">允许半星</Label>
                  <Switch id="rating-half" checked={ratingAllowHalf} onCheckedChange={setRatingAllowHalf} />
                </div>
              </div>
            )}

            {fieldType === FieldType.CURRENCY && (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="currency-code">币种</Label>
                  <Select value={currencyCode} onValueChange={setCurrencyCode}>
                    <SelectTrigger id="currency-code">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CNY">CNY (¥)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currency-decimals">小数位数</Label>
                  <Input
                    id="currency-decimals"
                    type="number"
                    min={0}
                    max={6}
                    value={currencyDecimals}
                    onChange={(e) => setCurrencyDecimals(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
              </div>
            )}

            {fieldType === FieldType.PERCENTAGE && (
              <div className="grid gap-2">
                <Label htmlFor="percentage-decimals">小数位数</Label>
                <Input
                  id="percentage-decimals"
                  type="number"
                  min={0}
                  max={4}
                  value={percentageDecimals}
                  onChange={(e) => setPercentageDecimals(Number(e.target.value))}
                  className="h-8"
                />
              </div>
            )}

            {fieldType === FieldType.DURATION && (
              <div className="grid gap-2">
                <Label htmlFor="duration-format">显示格式</Label>
                <Select value={durationFormat} onValueChange={setDurationFormat}>
                  <SelectTrigger id="duration-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hh:mm">hh:mm</SelectItem>
                    <SelectItem value="mm:ss">mm:ss</SelectItem>
                    <SelectItem value="hh:mm:ss">hh:mm:ss</SelectItem>
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

            {fieldType !== FieldType.COUNT && fieldType !== FieldType.LOOKUP &&
              fieldType !== FieldType.ROLLUP &&
              fieldType !== FieldType.FORMULA &&
              fieldType !== FieldType.AUTO_NUMBER && fieldType !== FieldType.SYSTEM_TIMESTAMP &&
              fieldType !== FieldType.SYSTEM_USER && (
              <div className="grid gap-2">
                <Label htmlFor="defaultValue">默认值</Label>
                <Input
                  id="defaultValue"
                  placeholder="可选"
                  value={defaultValue}
                  onChange={(event) => setDefaultValue(event.target.value)}
                />
              </div>
            )}

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

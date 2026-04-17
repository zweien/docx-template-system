"use client";

import { useState } from "react";
import { parseSelectOptions } from "@/types/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowDown, ArrowUp, Filter } from "lucide-react";
import { FieldType } from "@/generated/prisma/enums";
import type {
  DataFieldItem,
  FilterCondition,
  SortConfig,
} from "@/types/data-table";
import { parseRelationFieldRef } from "@/types/data-table";

interface ColumnHeaderProps {
  field: DataFieldItem;
  filter: FilterCondition | null;
  sort: SortConfig | null;
  onFilterChange: (filter: FilterCondition | null) => void;
  onSortChange: (sort: SortConfig | null) => void;
  /** Fetches fields for a related table (by table ID) */
  onFetchRelatedFields?: (tableId: string) => Promise<DataFieldItem[]>;
  groupBy?: string | null;
  onGroupByChange?: (fieldKey: string | null) => void;
  frozenFieldCount?: number;
  index?: number;
  onFrozenFieldCountChange?: (count: number) => void;
}

type FilterOperator = FilterCondition["op"];

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "等于",
  ne: "不等于",
  gt: "大于",
  lt: "小于",
  gte: "大于等于",
  lte: "小于等于",
  contains: "包含",
  notcontains: "不包含",
  startswith: "开头是",
  endswith: "结尾是",
  isempty: "为空",
  isnotempty: "不为空",
  between: "范围",
  in: "属于",
  notin: "不属于",
};

function getOperatorsForType(type: FieldType): FilterOperator[] {
  switch (type) {
    case FieldType.TEXT:
      return ["eq", "ne", "contains", "notcontains", "startswith", "endswith", "in", "notin", "isempty", "isnotempty"];
    case FieldType.NUMBER:
      return ["eq", "ne", "gt", "lt", "gte", "lte", "between", "isempty"];
    case FieldType.DATE:
      return ["eq", "gt", "lt", "gte", "lte", "between", "isempty"];
    case FieldType.SELECT:
      return ["eq", "ne", "in", "notin", "isempty"];
    case FieldType.MULTISELECT:
      return ["contains", "isempty"];
    case FieldType.EMAIL:
    case FieldType.PHONE:
      return ["eq", "contains", "notcontains", "startswith", "endswith", "isempty"];
    case FieldType.RELATION:
      return ["eq", "isempty"];
    case FieldType.FILE:
    case FieldType.URL:
      return ["eq", "ne", "contains", "notcontains", "isempty", "isnotempty"];
    case FieldType.BOOLEAN:
      return ["eq", "isempty"];
    case FieldType.AUTO_NUMBER:
      return ["eq", "ne", "gt", "lt", "gte", "lte", "between", "isempty"];
    case FieldType.SYSTEM_TIMESTAMP:
      return ["eq", "gt", "lt", "gte", "lte", "between", "isempty"];
    case FieldType.FORMULA:
      return ["eq", "ne", "gt", "lt", "gte", "lte", "between", "isempty", "isnotempty"];
    case FieldType.COUNT:
    case FieldType.ROLLUP:
      return ["eq", "ne", "gt", "lt", "gte", "lte", "between", "isempty"];
    case FieldType.LOOKUP:
      return ["eq", "ne", "contains", "notcontains", "isempty", "isnotempty"];
    default:
      return ["eq", "ne", "contains", "isempty", "isnotempty"];
  }
}

const NO_VALUE_OPS: FilterOperator[] = ["isempty", "isnotempty"];

export function ColumnHeader({
  field,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  groupBy,
  onGroupByChange,
  frozenFieldCount,
  index,
  onFrozenFieldCountChange,
  onFetchRelatedFields,
}: ColumnHeaderProps) {
  const [open, setOpen] = useState(false);

  const isRelationField = field.type === FieldType.RELATION || field.type === FieldType.RELATION_SUBTABLE;
  const relationFieldKey = field.key;
  const relationTableId = field.relationTo;

  // Parse existing filter to detect cross-table reference
  const existingRef = filter ? parseRelationFieldRef(filter.fieldKey) : null;
  const initialTargetFieldKey = existingRef?.relationFieldKey === relationFieldKey ? existingRef.targetFieldKey : "";

  const [targetFieldKey, setTargetFieldKey] = useState<string>(initialTargetFieldKey);
  const [relatedFields, setRelatedFields] = useState<DataFieldItem[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Resolve target field for operator selection
  const effectiveFieldType = (() => {
    if (!isRelationField) return field.type;
    if (!targetFieldKey) return null; // No target selected yet
    const tf = relatedFields.find((f) => f.key === targetFieldKey);
    return tf?.type ?? null;
  })();

  const [filterOp, setFilterOp] = useState<FilterOperator>(
    filter?.op ?? (effectiveFieldType ? getOperatorsForType(effectiveFieldType)[0] : "eq")
  );
  const [filterValue, setFilterValue] = useState<string>(
    filter
      ? filter.op === "between"
        ? `${(filter.value as { min: unknown; max: unknown }).min ?? ""}-${(filter.value as { min: unknown; max: unknown }).max ?? ""}`
        : Array.isArray(filter.value)
          ? (filter.value as unknown[]).join(",")
          : String(filter.value)
      : ""
  );

  // When popover opens, sync local state with props
  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      // Parse existing filter for cross-table reference
      const ref = filter ? parseRelationFieldRef(filter.fieldKey) : null;
      const tfk = ref?.relationFieldKey === relationFieldKey ? ref.targetFieldKey : "";
      setTargetFieldKey(tfk);

      // Load related fields if needed
      let loadedRelatedFields = relatedFields;
      if (isRelationField && relationTableId && onFetchRelatedFields) {
        setLoadingRelated(true);
        try {
          const fields = await onFetchRelatedFields(relationTableId);
          loadedRelatedFields = fields.filter((f) =>
            f.type !== "RELATION" && f.type !== "RELATION_SUBTABLE"
          );
          setRelatedFields(loadedRelatedFields);
        } catch { /* ignore */ }
        setLoadingRelated(false);
      }

      const resolvedType = isRelationField
        ? (tfk ? (loadedRelatedFields.find((f) => f.key === tfk)?.type ?? "TEXT") : "TEXT")
        : field.type;

      setFilterOp(filter?.op ?? getOperatorsForType(resolvedType as FieldType)[0]);
      setFilterValue(
        filter
          ? filter.op === "between"
            ? `${(filter.value as { min: unknown; max: unknown }).min ?? ""}-${(filter.value as { min: unknown; max: unknown }).max ?? ""}`
            : Array.isArray(filter.value)
              ? (filter.value as unknown[]).join(",")
              : String(filter.value)
          : ""
      );
    }
  };

  const handleApplyFilter = () => {
    const resolvedFieldKey = isRelationField && targetFieldKey
      ? `${relationFieldKey}.${targetFieldKey}`
      : field.key;
    const resolvedType = isRelationField && targetFieldKey
      ? (relatedFields.find((f) => f.key === targetFieldKey)?.type ?? "TEXT")
      : field.type;

    if (NO_VALUE_OPS.includes(filterOp)) {
      onFilterChange({ fieldKey: resolvedFieldKey, op: filterOp, value: "" });
    } else if (filterOp === "between") {
      const parts = filterValue.split("-").map((s) => s.trim());
      const min = resolvedType === FieldType.NUMBER ? Number(parts[0]) : parts[0] ?? "";
      const max = resolvedType === FieldType.NUMBER ? Number(parts[1]) : parts[1] ?? "";
      if (!isNaN(Number(min)) && !isNaN(Number(max))) {
        onFilterChange({ fieldKey: resolvedFieldKey, op: filterOp, value: { min, max } });
      }
    } else if (filterOp === "in" || filterOp === "notin") {
      const items = filterValue.split(",").map((s) => s.trim()).filter(Boolean);
      if (items.length > 0) {
        const value = resolvedType === FieldType.NUMBER ? items.map(Number) : items;
        onFilterChange({ fieldKey: resolvedFieldKey, op: filterOp, value });
      }
    } else if (filterValue) {
      const value: string | number =
        resolvedType === FieldType.NUMBER && !isNaN(Number(filterValue))
          ? Number(filterValue)
          : filterValue;
      onFilterChange({ fieldKey: resolvedFieldKey, op: filterOp, value });
    }
    setOpen(false);
  };

  const handleClear = () => {
    onFilterChange(null);
    onSortChange(null);
    setOpen(false);
  };

  const handleSortClick = (order: "asc" | "desc", sortTargetField?: string) => {
    const resolvedFieldKey = isRelationField && sortTargetField
      ? `${relationFieldKey}.${sortTargetField}`
      : field.key;
    if (sort?.fieldKey === resolvedFieldKey && sort?.order === order) {
      onSortChange(null);
    } else {
      onSortChange({ fieldKey: resolvedFieldKey, order });
    }
  };

  const operators: FilterOperator[] = effectiveFieldType
    ? getOperatorsForType(effectiveFieldType)
    : isRelationField
      ? (["eq", "isempty"] as FilterOperator[])
      : getOperatorsForType(field.type);
  const hideValue = NO_VALUE_OPS.includes(filterOp);

  // Build filter summary text
  const getFilterSummary = () => {
    if (!filter) return null;
    const opLabel = OPERATOR_LABELS[filter.op] ?? filter.op;
    const val = NO_VALUE_OPS.includes(filter.op)
      ? ""
      : filter.op === "between"
        ? `${(filter.value as { min: unknown; max: unknown }).min}~${(filter.value as { min: unknown; max: unknown }).max}`
        : Array.isArray(filter.value)
          ? (filter.value as unknown[]).join(",")
          : `"${filter.value}"`;
    return `${opLabel}${val}`;
  };

  const filterSummary = getFilterSummary();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button className="flex items-center gap-1 text-sm font-medium hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors select-none min-w-0" />
        }
      >
        <span className="truncate">{field.label}</span>
        {sort && (
          <span className="shrink-0 text-primary">
            {sort.order === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
          </span>
        )}
        {filter && (
          <span className="shrink-0 text-primary">
            <Filter className="h-3 w-3" />
          </span>
        )}
        {filterSummary && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {filterSummary}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-56 p-3">
        {/* Sort section */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground mb-1">排序</Label>
          {isRelationField && relatedFields.length > 0 && (
            <Select
              value={(() => {
                const sortRef = sort ? parseRelationFieldRef(sort.fieldKey) : null;
                return sortRef?.relationFieldKey === relationFieldKey ? sortRef.targetFieldKey : field.displayField ?? "";
              })()}
              onValueChange={(v) => { if (v) setTargetFieldKey(v); }}
            >
              <SelectTrigger size="sm" className="w-full mb-1">
                <SelectValue placeholder="选择排序依据字段" />
              </SelectTrigger>
              <SelectContent>
                {relatedFields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1">
            <Button
              variant={sort?.order === "asc" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleSortClick("asc", isRelationField ? targetFieldKey || undefined : undefined)}
            >
              <ArrowUp className="h-3 w-3 mr-1" />
              升序
            </Button>
            <Button
              variant={sort?.order === "desc" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleSortClick("desc", isRelationField ? targetFieldKey || undefined : undefined)}
            >
              <ArrowDown className="h-3 w-3 mr-1" />
              降序
            </Button>
          </div>
        </div>

        {onGroupByChange &&
          ([
            FieldType.TEXT,
            FieldType.NUMBER,
            FieldType.DATE,
            FieldType.SELECT,
            FieldType.EMAIL,
            FieldType.PHONE,
          ] as FieldType[]).includes(field.type) && (
            <>
              <Separator />
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground mb-1">分组</Label>
                <Button
                  variant={groupBy === field.key ? "secondary" : "ghost"}
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onGroupByChange(groupBy === field.key ? null : field.key);
                    setOpen(false);
                  }}
                >
                  {groupBy === field.key ? "取消分组" : "按此字段分组"}
                </Button>
              </div>
            </>
          )}

        {onFrozenFieldCountChange && typeof index === "number" && (
          <>
            <Separator />
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground mb-1">冻结</Label>
              <Button
                variant={(frozenFieldCount ?? 0) > 0 && typeof index === "number" && (frozenFieldCount ?? 0) > index ? "secondary" : "ghost"}
                size="sm"
                className="text-xs"
                onClick={() => {
                  if ((frozenFieldCount ?? 0) > 0 && (frozenFieldCount ?? 0) === (index ?? 0) + 1) {
                    onFrozenFieldCountChange(0);
                  } else {
                    onFrozenFieldCountChange((index ?? 0) + 1);
                  }
                  setOpen(false);
                }}
              >
                {(frozenFieldCount ?? 0) > 0 && typeof index === "number" && (frozenFieldCount ?? 0) > index ? "取消冻结" : "冻结到此列"}
              </Button>
            </div>
          </>
        )}

        <Separator />

        {/* Filter section */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">筛选</Label>
          {isRelationField && relatedFields.length > 0 && (
            <Select
              value={targetFieldKey}
              onValueChange={(v) => {
                if (!v) return;
                setTargetFieldKey(v);
                const tf = relatedFields.find((f) => f.key === v);
                if (tf) {
                  setFilterOp(getOperatorsForType(tf.type)[0]);
                }
                setFilterValue("");
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="选择目标字段" />
              </SelectTrigger>
              <SelectContent>
                {relatedFields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(isRelationField ? targetFieldKey : true) && (
            <Select
              value={filterOp}
              onValueChange={(v) => {
                if (!v) return;
                setFilterOp(v as FilterOperator);
              }}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!hideValue && (isRelationField ? targetFieldKey : true) &&
            (() => {
              const targetField = isRelationField
                ? relatedFields.find((f) => f.key === targetFieldKey)
                : field;
              const isSelectWithOpts = targetField?.type === FieldType.SELECT && targetField.options && filterOp !== "in" && filterOp !== "notin";
              if (isSelectWithOpts) {
                return (
                  <Select
                    value={filterValue}
                    onValueChange={(v) => {
                      if (!v) return;
                      setFilterValue(v);
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="选择值" />
                    </SelectTrigger>
                    <SelectContent>
                      {parseSelectOptions(targetField!.options).map((opt: { label: string }) => (
                        <SelectItem key={opt.label} value={opt.label}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }
              return (
                <Input
                  placeholder={
                    filterOp === "between"
                      ? "最小值-最大值（如 10-100）"
                      : filterOp === "in" || filterOp === "notin"
                        ? "多个值，逗号分隔"
                        : "输入值"
                  }
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilter()}
                  type={effectiveFieldType === FieldType.NUMBER && filterOp !== "between" ? "number" : "text"}
                />
              );
            })()}
        </div>

        <Separator />

        {/* Action buttons */}
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            清除
          </Button>
          <Button size="sm" onClick={handleApplyFilter}>
            应用
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

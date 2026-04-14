"use client";

import { useState } from "react";
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

interface ColumnHeaderProps {
  field: DataFieldItem;
  filter: FilterCondition | null;
  sort: SortConfig | null;
  onFilterChange: (filter: FilterCondition | null) => void;
  onSortChange: (sort: SortConfig | null) => void;
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
}: ColumnHeaderProps) {
  const [open, setOpen] = useState(false);
  const [filterOp, setFilterOp] = useState<FilterOperator>(
    filter?.op ?? getOperatorsForType(field.type)[0]
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
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setFilterOp(filter?.op ?? getOperatorsForType(field.type)[0]);
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
    if (NO_VALUE_OPS.includes(filterOp)) {
      onFilterChange({ fieldKey: field.key, op: filterOp, value: "" });
    } else if (filterOp === "between") {
      const parts = filterValue.split("-").map((s) => s.trim());
      const min = field.type === FieldType.NUMBER ? Number(parts[0]) : parts[0] ?? "";
      const max = field.type === FieldType.NUMBER ? Number(parts[1]) : parts[1] ?? "";
      if (!isNaN(Number(min)) && !isNaN(Number(max))) {
        onFilterChange({ fieldKey: field.key, op: filterOp, value: { min, max } });
      }
    } else if (filterOp === "in" || filterOp === "notin") {
      const items = filterValue.split(",").map((s) => s.trim()).filter(Boolean);
      if (items.length > 0) {
        const value = field.type === FieldType.NUMBER ? items.map(Number) : items;
        onFilterChange({ fieldKey: field.key, op: filterOp, value });
      }
    } else if (filterValue) {
      const value: string | number =
        field.type === FieldType.NUMBER && !isNaN(Number(filterValue))
          ? Number(filterValue)
          : filterValue;
      onFilterChange({ fieldKey: field.key, op: filterOp, value });
    }
    setOpen(false);
  };

  const handleClear = () => {
    onFilterChange(null);
    onSortChange(null);
    setOpen(false);
  };

  const handleSortClick = (order: "asc" | "desc") => {
    if (sort?.fieldKey === field.key && sort?.order === order) {
      // Click same sort again -> toggle off
      onSortChange(null);
    } else {
      onSortChange({ fieldKey: field.key, order });
    }
  };

  const operators = getOperatorsForType(field.type);
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
          <div className="flex gap-1">
            <Button
              variant={sort?.order === "asc" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleSortClick("asc")}
            >
              <ArrowUp className="h-3 w-3 mr-1" />
              升序
            </Button>
            <Button
              variant={sort?.order === "desc" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleSortClick("desc")}
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

          {!hideValue &&
            (field.type === FieldType.SELECT && field.options && filterOp !== "in" && filterOp !== "notin" ? (
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
                  {(field.options as string[]).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
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
                type={field.type === FieldType.NUMBER && filterOp !== "between" ? "number" : "text"}
              />
            ))}
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

"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import type { DataFieldItem, FilterCondition, FilterGroup } from "@/types/data-table"
import { Plus, Trash2, ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"

const OPERATOR_OPTIONS = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "notcontains", label: "不包含" },
  { value: "startswith", label: "开头是" },
  { value: "endswith", label: "结尾是" },
  { value: "isempty", label: "为空" },
  { value: "isnotempty", label: "不为空" },
  { value: "gt", label: "大于" },
  { value: "lt", label: "小于" },
  { value: "gte", label: "大于等于" },
  { value: "lte", label: "小于等于" },
  { value: "between", label: "范围" },
  { value: "in", label: "属于" },
  { value: "notin", label: "不属于" },
]

const NO_VALUE_OPS = ["isempty", "isnotempty"]

interface FilterPanelProps {
  fields: DataFieldItem[]
  filters: FilterGroup[]
  onChange: (filters: FilterGroup[]) => void
}

export function FilterPanel({ fields, filters, onChange }: FilterPanelProps) {
  const updateGroup = useCallback(
    (groupIndex: number, updater: (group: FilterGroup) => FilterGroup) => {
      onChange(filters.map((g, i) => (i === groupIndex ? updater(g) : g)))
    },
    [filters, onChange],
  )

  const addGroup = useCallback(() => {
    onChange([...filters, { operator: "AND", conditions: [{ fieldKey: fields[0]?.key ?? "", op: "eq", value: "" }] }])
  }, [filters, fields, onChange])

  const removeGroup = useCallback(
    (groupIndex: number) => {
      onChange(filters.filter((_, i) => i !== groupIndex))
    },
    [filters, onChange],
  )

  const addCondition = useCallback(
    (groupIndex: number) => {
      updateGroup(groupIndex, (g) => ({
        ...g,
        conditions: [...g.conditions, { fieldKey: fields[0]?.key ?? "", op: "eq", value: "" }],
      }))
    },
    [fields, updateGroup],
  )

  const updateCondition = useCallback(
    (groupIndex: number, condIndex: number, patch: Partial<FilterCondition>) => {
      updateGroup(groupIndex, (g) => ({
        ...g,
        conditions: g.conditions.map((c, i) => (i === condIndex ? { ...c, ...patch } : c)),
      }))
    },
    [updateGroup],
  )

  const removeCondition = useCallback(
    (groupIndex: number, condIndex: number) => {
      updateGroup(groupIndex, (g) => ({
        ...g,
        conditions: g.conditions.filter((_, i) => i !== condIndex),
      }))
    },
    [updateGroup],
  )

  const hasFilters = filters.some((g) => g.conditions.length > 0)

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className={cn(hasFilters && "border-primary")} />}>
        <ListFilter className="h-4 w-4 mr-1" />
        筛选 {hasFilters && `(${filters.reduce((acc, g) => acc + g.conditions.length, 0)})`}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[520px] max-h-[400px] overflow-y-auto p-3 space-y-3">
        {filters.map((group, gi) => (
          <div key={gi} className="border rounded-md p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">条件组 {gi + 1}</span>
                <Select
                  value={group.operator}
                  onValueChange={(v) => updateGroup(gi, (g) => ({ ...g, operator: (v ?? "AND") as "AND" | "OR" }))}
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
              {filters.length > 1 && (
                <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => removeGroup(gi)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {group.conditions.map((cond, ci) => (
              <div key={ci} className="flex items-center gap-1">
                <Select value={cond.fieldKey} onValueChange={(v) => updateCondition(gi, ci, { fieldKey: v ?? "" })}>
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue placeholder="选择字段" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cond.op} onValueChange={(v) => updateCondition(gi, ci, { op: (v ?? "eq") as FilterCondition["op"] })}>
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((o) => (
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
                          : String(cond.value)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (cond.op === "between") {
                        const parts = raw.split("-").map(s => s.trim());
                        updateCondition(gi, ci, { value: { min: parts[0] ?? "", max: parts[1] ?? "" } });
                      } else if (cond.op === "in" || cond.op === "notin") {
                        updateCondition(gi, ci, { value: raw.split(",").map(s => s.trim()).filter(Boolean) });
                      } else {
                        updateCondition(gi, ci, { value: raw });
                      }
                    }}
                    placeholder={
                      cond.op === "between"
                        ? "最小值-最大值"
                        : cond.op === "in" || cond.op === "notin"
                          ? "逗号分隔多个值"
                          : "值"
                    }
                  />
                )}
                <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => removeCondition(gi, ci)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addCondition(gi)}>
              <Plus className="h-3 w-3 mr-1" /> 添加条件
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={addGroup}>
          <Plus className="h-3 w-3 mr-1" /> 添加条件组
        </Button>
      </PopoverContent>
    </Popover>
  )
}

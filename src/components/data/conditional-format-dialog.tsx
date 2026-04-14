"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Paintbrush, Plus, Trash2 } from "lucide-react"
import type { ConditionalFormatRule, DataFieldItem, FilterCondition } from "@/types/data-table"

const PRESET_COLORS = [
  { bg: "#fef3c7", text: "#92400e", label: "琥珀" },
  { bg: "#dbeafe", text: "#1e40af", label: "蓝色" },
  { bg: "#dcfce7", text: "#166534", label: "绿色" },
  { bg: "#fce7f3", text: "#9d174d", label: "粉色" },
  { bg: "#f3e8ff", text: "#6b21a8", label: "紫色" },
  { bg: "#fed7aa", text: "#9a3412", label: "橙色" },
  { bg: "#e0e7ff", text: "#3730a3", label: "靛蓝" },
  { bg: "#ccfbf1", text: "#115e59", label: "青色" },
  { bg: "#fecaca", text: "#991b1b", label: "红色" },
  { bg: "#f5f5f4", text: "#44403c", label: "灰色" },
  { bg: "#fef08a", text: "#854d0e", label: "黄色" },
  { bg: "#c7d2fe", text: "#4338ca", label: "靛蓝淡" },
]

const OPERATOR_OPTIONS = [
  { value: "eq", label: "等于" },
  { value: "ne", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "notcontains", label: "不包含" },
  { value: "isempty", label: "为空" },
  { value: "isnotempty", label: "不为空" },
  { value: "gt", label: "大于" },
  { value: "lt", label: "小于" },
  { value: "gte", label: "大于等于" },
  { value: "lte", label: "小于等于" },
  { value: "startswith", label: "开头是" },
  { value: "endswith", label: "结尾是" },
]

interface ConditionalFormatDialogProps {
  fields: DataFieldItem[]
  rules: ConditionalFormatRule[]
  onChange: (rules: ConditionalFormatRule[]) => void
  quickCreateField?: string
  quickCreateValue?: string
}

export function ConditionalFormatDialog({
  fields,
  rules,
  onChange,
  quickCreateField,
  quickCreateValue,
}: ConditionalFormatDialogProps) {
  const [open, setOpen] = useState(false)

  const addRule = useCallback(() => {
    if (rules.length >= 20) return
    const newRule: ConditionalFormatRule = {
      id: `rule-${Date.now()}`,
      condition: {
        fieldKey: quickCreateField ?? fields[0]?.key ?? "",
        op: "eq",
        value: quickCreateValue ?? "",
      },
      backgroundColor: PRESET_COLORS[0].bg,
      textColor: PRESET_COLORS[0].text,
      scope: "cell",
    }
    onChange([...rules, newRule])
  }, [fields, quickCreateField, quickCreateValue, rules, onChange])

  const removeRule = useCallback(
    (ruleId: string) => {
      onChange(rules.filter((r) => r.id !== ruleId))
    },
    [rules, onChange],
  )

  const updateRule = useCallback(
    (ruleId: string, patch: Partial<ConditionalFormatRule>) => {
      onChange(rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)))
    },
    [rules, onChange],
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Paintbrush className="h-4 w-4 mr-1" />
        条件格式 {rules.length > 0 && `(${rules.length})`}
      </DialogTrigger>
      <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>条件格式规则</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="border rounded-md p-3 space-y-2"
              style={{ borderLeftColor: rule.backgroundColor, borderLeftWidth: 4 }}
            >
              <div className="flex items-center justify-between">
                <Input
                  className="h-7 text-xs w-[120px]"
                  value={rule.name ?? ""}
                  onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                  placeholder="规则名称"
                />
                <div className="flex items-center gap-2">
                  <Select
                    value={rule.scope}
                    onValueChange={(v) => updateRule(rule.id, { scope: v as "row" | "cell" })}
                  >
                    <SelectTrigger className="h-7 w-[80px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cell">单元格</SelectItem>
                      <SelectItem value="row">整行</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => removeRule(rule.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value={rule.condition.fieldKey}
                  onValueChange={(v) =>
                    updateRule(rule.id, { condition: { ...rule.condition, fieldKey: v! } })
                  }
                >
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rule.condition.op}
                  onValueChange={(v) =>
                    updateRule(rule.id, { condition: { ...rule.condition, op: v as FilterCondition["op"] } })
                  }
                >
                  <SelectTrigger className="h-7 w-[90px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!["isempty", "isnotempty"].includes(rule.condition.op) && (
                  <Input
                    className="h-7 flex-1 text-xs"
                    value={String(rule.condition.value)}
                    onChange={(e) =>
                      updateRule(rule.id, { condition: { ...rule.condition, value: e.target.value } })
                    }
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.bg}
                    className="w-7 h-7 rounded border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.bg,
                      borderColor: rule.backgroundColor === c.bg ? "#333" : "transparent",
                    }}
                    title={c.label}
                    onClick={() => updateRule(rule.id, { backgroundColor: c.bg, textColor: c.text })}
                  />
                ))}
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              暂无条件格式规则
            </p>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={addRule}>
            <Plus className="h-3 w-3 mr-1" /> 添加规则
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

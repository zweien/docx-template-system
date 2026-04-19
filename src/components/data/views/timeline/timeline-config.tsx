"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem } from "@/types/data-table";

interface TimelineConfigProps {
  fields: DataFieldItem[];
  startDateField: string | null;
  endDateField: string | null;
  labelField: string | null;
  milestoneFieldKey: string | null;
  dependencyEnabled: boolean;
  onChange: (key: string, value: string | null) => void;
  onToggleChange: (key: string, value: boolean) => void;
}

export function TimelineConfig({
  fields,
  startDateField,
  endDateField,
  labelField,
  milestoneFieldKey,
  dependencyEnabled,
  onChange,
  onToggleChange,
}: TimelineConfigProps) {
  const dateFields = fields.filter((f) => f.type === FieldType.DATE);
  const booleanFields = fields.filter((f) => f.type === FieldType.BOOLEAN);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">开始日期字段 *</Label>
        <Select
          value={startDateField ?? ""}
          onValueChange={(v) => onChange("startDateField", v || null)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="选择日期字段" />
          </SelectTrigger>
          <SelectContent>
            {dateFields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label} ({f.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">结束日期字段</Label>
        <Select
          value={endDateField ?? "_none"}
          onValueChange={(v) => onChange("endDateField", v === "_none" ? null : v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="可选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">不选择</SelectItem>
            {dateFields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label} ({f.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">标签字段 *</Label>
        <Select
          value={labelField ?? ""}
          onValueChange={(v) => onChange("labelField", v || null)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="选择标签字段" />
          </SelectTrigger>
          <SelectContent>
            {fields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label} ({f.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">里程碑字段</Label>
        <Select
          value={milestoneFieldKey ?? "_none"}
          onValueChange={(v) => onChange("milestoneFieldKey", v === "_none" ? null : v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="可选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">不选择</SelectItem>
            {booleanFields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label} ({f.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-md border px-3 py-2 sm:col-span-3">
        <Label className="text-xs text-muted-foreground">启用依赖连线</Label>
        <Switch
          checked={dependencyEnabled}
          onCheckedChange={(checked) => onToggleChange("dependencyEnabled", checked)}
          size="sm"
        />
      </div>
    </div>
  );
}

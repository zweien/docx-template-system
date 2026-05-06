"use client";

import { Checkbox } from "@/components/ui/checkbox";

export interface CollectionAssigneeOption {
  id: string;
  name: string;
  email: string;
}

export function CollectionAssigneePicker({
  options,
  value,
  onChange,
}: {
  options: CollectionAssigneeOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggleAssignee(userId: string, checked: boolean) {
    if (checked) {
      onChange(Array.from(new Set([...value, userId])));
      return;
    }

    onChange(value.filter((item) => item !== userId));
  }

  const allSelected = options.length > 0 && value.length === options.length;

  function toggleAll(checked: boolean) {
    onChange(checked ? options.map((o) => o.id) : []);
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无可选提交人</p>
      ) : (
        <>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border-b pb-2 px-2 hover:bg-muted/50">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => toggleAll(checked === true)}
            />
            <span className="text-sm text-muted-foreground">全选</span>
          </label>
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
            >
              <Checkbox
                checked={value.includes(option.id)}
                onCheckedChange={(checked) => toggleAssignee(option.id, checked === true)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block text-xs text-muted-foreground">{option.email}</span>
              </span>
            </label>
          ))}
        </>
      )}
    </div>
  );
}

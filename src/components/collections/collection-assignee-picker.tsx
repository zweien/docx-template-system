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

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无可选提交人</p>
      ) : (
        options.map((option) => (
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
        ))
      )}
    </div>
  );
}

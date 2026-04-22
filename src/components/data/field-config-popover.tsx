"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Settings2, ArrowUp, ArrowDown } from "lucide-react";
import type { DataFieldItem } from "@/types/data-table";

interface FieldConfigPopoverProps {
  fields: DataFieldItem[];
  visibleFields: string[];
  fieldOrder: string[];
  onChange: (visibleFields: string[], fieldOrder: string[]) => void;
}

export function FieldConfigPopover({
  fields,
  visibleFields,
  fieldOrder,
  onChange,
}: FieldConfigPopoverProps) {
  const [open, setOpen] = useState(false);
  const [localVisible, setLocalVisible] = useState<string[]>(visibleFields);
  const [localOrder, setLocalOrder] = useState<string[]>(fieldOrder);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      // Sync local state with props when opening
      setLocalVisible([...visibleFields]);
      setLocalOrder([...fieldOrder]);
    }
  };

  const fieldsInOrder = localOrder
    .map((key) => fields.find((f) => f.key === key))
    .filter(Boolean) as DataFieldItem[];

  // Fields that are in fieldOrder but might not have been synced yet
  const orderedFields = localOrder.length === fields.length
    ? fieldsInOrder
    : [...fieldsInOrder, ...fields.filter((f) => !localOrder.includes(f.key))];

  const handleToggleField = (fieldKey: string, checked: boolean | null) => {
    if (checked === false) {
      // Cannot uncheck the last visible field
      if (localVisible.length <= 1) return;
      setLocalVisible((prev) => prev.filter((k) => k !== fieldKey));
    } else {
      if (!localVisible.includes(fieldKey)) {
        setLocalVisible((prev) => [...prev, fieldKey]);
      }
    }
    // Apply immediately
    const nextVisible = checked === false
      ? localVisible.filter((k) => k !== fieldKey)
      : localVisible.includes(fieldKey)
        ? localVisible
        : [...localVisible, fieldKey];
    onChange(nextVisible, localOrder);
  };

  const handleSelectAll = () => {
    const allKeys = localOrder.length === fields.length
      ? fields.map((f) => f.key)
      : [...new Set([...localOrder, ...fields.map((f) => f.key)])];
    const nextOrder = localOrder.length === fields.length
      ? localOrder
      : allKeys;
    setLocalVisible(allKeys);
    onChange(allKeys, nextOrder);
  };

  const handleDeselectAll = () => {
    // Keep only the first visible field
    const remaining = localVisible[0] ? [localVisible[0]] : [orderedFields[0]?.key].filter(Boolean) as string[];
    setLocalVisible(remaining);
    onChange(remaining, localOrder);
  };

  const handleMoveUp = (fieldKey: string) => {
    const idx = localOrder.indexOf(fieldKey);
    if (idx <= 0) return;
    const next = [...localOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setLocalOrder(next);
    onChange(localVisible, next);
  };

  const handleMoveDown = (fieldKey: string) => {
    const idx = localOrder.indexOf(fieldKey);
    if (idx < 0 || idx >= localOrder.length - 1) return;
    const next = [...localOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setLocalOrder(next);
    onChange(localVisible, next);
  };

  const allSelected = orderedFields.every((f) => localVisible.includes(f.key));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <Settings2 className="h-4 w-4" />
        字段
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-64 border-[rgb(255_255_255_/_0.08)] bg-[#191a1b] p-3 text-[#d0d6e0]">
        {/* Select all / Deselect all */}
        <div className="flex gap-2 mb-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleSelectAll}
            disabled={allSelected}
          >
            全选
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleDeselectAll}
            disabled={localVisible.length <= 1}
          >
            取消全选
          </Button>
        </div>

        <Separator className="bg-[rgb(255_255_255_/_0.08)]" />

        {/* Field list */}
        <div className="flex flex-col gap-0.5 mt-2 max-h-64 overflow-y-auto">
          {orderedFields.map((field) => {
            const isChecked = localVisible.includes(field.key);
            const isFirst = localOrder.indexOf(field.key) === 0;
            const isLast = localOrder.indexOf(field.key) === localOrder.length - 1;
            const isLastVisible =
              localVisible.length <= 1 && isChecked;

            return (
              <div
                key={field.key}
                className="flex items-center gap-2 rounded px-1 py-1 hover:bg-[rgb(255_255_255_/_0.04)]"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleToggleField(field.key, checked)
                  }
                  disabled={isLastVisible}
                />
                <span className="flex-1 truncate text-sm">{field.label}</span>
                <div className="flex gap-0.5 shrink-0">
                  <button
                    className="rounded p-0.5 text-[#8a8f98] hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[#f7f8f8] disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => handleMoveUp(field.key)}
                    disabled={isFirst}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    className="rounded p-0.5 text-[#8a8f98] hover:bg-[rgb(255_255_255_/_0.06)] hover:text-[#f7f8f8] disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => handleMoveDown(field.key)}
                    disabled={isLast}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

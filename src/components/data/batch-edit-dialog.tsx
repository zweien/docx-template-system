"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem } from "@/types/data-table";

interface BatchEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: DataFieldItem[];
  onApply: (fieldKey: string, value: unknown) => void;
}

const EDITABLE_TYPES: FieldType[] = [
  FieldType.TEXT,
  FieldType.NUMBER,
  FieldType.DATE,
  FieldType.EMAIL,
  FieldType.PHONE,
  FieldType.SELECT,
];

export function BatchEditDialog({
  open,
  onOpenChange,
  fields,
  onApply,
}: BatchEditDialogProps) {
  const [fieldKey, setFieldKey] = useState("");
  const [value, setValue] = useState("");

  const editableFields = fields.filter((f) => EDITABLE_TYPES.includes(f.type));
  const selectedField = editableFields.find((f) => f.key === fieldKey);

  const handleApply = () => {
    if (!fieldKey) return;
    const typedValue =
      selectedField?.type === FieldType.NUMBER
        ? Number(value) || 0
        : value;
    onApply(fieldKey, typedValue);
    onOpenChange(false);
    setFieldKey("");
    setValue("");
  };

  const handleClose = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setFieldKey("");
      setValue("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批量编辑</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">字段</Label>
            <Select
              value={fieldKey}
              onValueChange={(v) => {
                if (v) setFieldKey(v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择要编辑的字段" />
              </SelectTrigger>
              <SelectContent>
                {editableFields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedField?.type === FieldType.SELECT &&
          selectedField.options ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">值</Label>
              <Select
                value={value}
                onValueChange={(v) => {
                  if (v) setValue(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择值" />
                </SelectTrigger>
                <SelectContent>
                  {selectedField.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">新值</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="输入新值"
                type={
                  selectedField?.type === FieldType.NUMBER ? "number" : "text"
                }
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleApply} disabled={!fieldKey}>
            应用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

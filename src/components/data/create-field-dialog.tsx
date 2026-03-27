"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { generateFieldKey } from "@/lib/utils";
import type { FieldType } from "@/generated/prisma/enums";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "TEXT", label: "文本" },
  { value: "NUMBER", label: "数字" },
  { value: "DATE", label: "日期" },
  { value: "SELECT", label: "单选" },
  { value: "MULTISELECT", label: "多选" },
  { value: "EMAIL", label: "邮箱" },
  { value: "PHONE", label: "电话" },
];

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface CreateFieldFormData {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  defaultValue: string;
}

interface CreateFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnLabel: string;
  existingKeys: string[];
  onSubmit: (data: CreateFieldFormData) => void | Promise<void>;
}

export function CreateFieldDialog({
  open,
  onOpenChange,
  columnLabel,
  existingKeys,
  onSubmit,
}: CreateFieldDialogProps) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("TEXT");
  const [required, setRequired] = useState(false);
  const [optionsInput, setOptionsInput] = useState("");
  const [defaultValue, setDefaultValue] = useState("");
  const [keyError, setKeyError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 预填逻辑
  useEffect(() => {
    if (open) {
      setLabel(columnLabel);
      setKey(generateFieldKey(columnLabel, existingKeys));
      setType("TEXT");
      setRequired(false);
      setOptionsInput("");
      setDefaultValue("");
      setKeyError("");
    }
  }, [open, columnLabel, existingKeys]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError("");

    if (!key.trim()) {
      setKeyError("字段标识不能为空");
      return;
    }
    if (!KEY_PATTERN.test(key)) {
      setKeyError("必须以小写字母开头，只能包含小写字母、数字和下划线");
      return;
    }
    if (existingKeys.includes(key)) {
      setKeyError("该字段标识已存在");
      return;
    }
    if (!label.trim()) {
      return;
    }

    const options = ["SELECT", "MULTISELECT"].includes(type)
      ? optionsInput
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    setIsLoading(true);
    try {
      await onSubmit({
        key: key.trim(),
        label: label.trim(),
        type,
        required,
        options,
        defaultValue: defaultValue.trim(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const needsOptions = type === "SELECT" || type === "MULTISELECT";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新建字段</DialogTitle>
            <DialogDescription>
              为导入数据创建新的字段
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="field-label">
                显示名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="field-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="field-key">
                字段标识 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="field-key"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setKeyError("");
                }}
                disabled={isLoading}
                required
              />
              {keyError && <p className="text-xs text-red-500">{keyError}</p>}
              <p className="text-xs text-zinc-400">
                用于 API 和数据存储，创建后不可修改
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="field-type">字段类型</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as FieldType)}
              >
                <SelectTrigger id="field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsOptions && (
              <div className="grid gap-2">
                <Label htmlFor="field-options">选项列表</Label>
                <textarea
                  id="field-options"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="每行一个选项"
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  disabled={isLoading}
                  rows={3}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="field-default">默认值</Label>
              <Input
                id="field-default"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                disabled={isLoading}
                placeholder="可选"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="field-required"
                checked={required}
                onCheckedChange={(v) => setRequired(v === true)}
                disabled={isLoading}
              />
              <Label htmlFor="field-required" className="font-normal cursor-pointer">
                必填字段
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

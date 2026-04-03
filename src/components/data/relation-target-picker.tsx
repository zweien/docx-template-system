"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RelationTargetOption {
  id: string;
  label: string;
}

interface RelationTargetPickerProps {
  value: RelationTargetOption | null;
  onChange: (value: RelationTargetOption | null) => void;
  relationTableId: string;
  displayField: string;
  triggerId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function RelationTargetPicker({
  value,
  onChange,
  relationTableId,
  displayField,
  triggerId,
  placeholder = "选择目标记录",
  disabled = false,
}: RelationTargetPickerProps) {
  const [options, setOptions] = useState<RelationTargetOption[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!relationTableId) {
      setOptions([]);
      setErrorMessage("");
      return;
    }

    const controller = new AbortController();

    async function fetchOptions() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) {
          params.set("search", search);
        }
        if (displayField) {
          params.set("displayField", displayField);
        }

        const response = await fetch(
          `/api/data-tables/${relationTableId}/relation-options?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          setOptions([]);
          setErrorMessage("加载关联记录失败");
          return;
        }

        const result = (await response.json()) as RelationTargetOption[];
        setOptions(Array.isArray(result) ? result : []);
        setErrorMessage("");
      } catch (error) {
        if (
          error instanceof Error &&
          error.name !== "AbortError"
        ) {
          console.error("加载目标记录失败:", error);
          setOptions([]);
          setErrorMessage("加载关联记录失败");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    fetchOptions();

    return () => {
      controller.abort();
    };
  }, [displayField, relationTableId, search]);

  const optionMap = useMemo(() => {
    return new Map(options.map((option) => [option.id, option]));
  }, [options]);

  const selectedLabel = value?.id
    ? optionMap.get(value.id)?.label ?? value.label
    : null;

  return (
    <Select
      value={value?.id ?? ""}
      onValueChange={(nextId) => {
        if (!nextId) {
          onChange(null);
          return;
        }

        const nextOption = optionMap.get(nextId);
        onChange(
          nextOption ?? { id: nextId, label: nextId }
        );
      }}
      disabled={disabled || !relationTableId}
    >
      <SelectTrigger id={triggerId} className="w-full">
        {selectedLabel ? (
          <span className="flex-1 truncate text-left">
            {selectedLabel}
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <div className="border-b p-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索..."
            className="h-8"
          />
        </div>
        <div className="max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-2 text-center text-sm text-zinc-500">
              加载中...
            </div>
          ) : errorMessage ? (
            <div className="p-2 text-center text-sm text-red-500">
              {errorMessage}
            </div>
          ) : options.length === 0 ? (
            <div className="p-2 text-center text-sm text-zinc-500">
              {search ? "无匹配结果" : "暂无记录"}
            </div>
          ) : (
            options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

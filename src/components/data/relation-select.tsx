"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { DataRecordItem } from "@/types/data-table";

interface RelationSelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  relationTableId: string;
  displayField: string;
  placeholder?: string;
  disabled?: boolean;
}

export function RelationSelect({
  value,
  onChange,
  relationTableId,
  displayField,
  placeholder = "选择关联记录",
  disabled = false,
}: RelationSelectProps) {
  const [records, setRecords] = useState<DataRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchRecords = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/data-tables/${relationTableId}/records?pageSize=100`
        );
        const data = await response.json();

        if (response.ok) {
          setRecords(data.records || []);
        }
      } catch (error) {
        console.error("加载关联记录失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [relationTableId]);

  // Filter records by search
  const filteredRecords = useMemo(() => {
    if (!search) return records;
    return records.filter((record) => {
      const displayValue = record.data[displayField];
      return String(displayValue)
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [records, search, displayField]);

  // Get display value for current selection
  const selectedRecord = records.find((r) => r.id === value);
  const selectedDisplay = selectedRecord?.data[displayField];

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v || null)}
      disabled={disabled}
    >
      <SelectTrigger>
        {selectedDisplay != null ? (
          <span className="flex-1 text-left truncate">{String(selectedDisplay)}</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        {/* Search input */}
        <div className="p-2 border-b">
          <Input
            placeholder="搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Options */}
        <div className="max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-2 text-center text-zinc-500">
              加载中...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-2 text-center text-zinc-500">
              {search ? "无匹配结果" : "暂无记录"}
            </div>
          ) : (
            filteredRecords.map((record) => (
              <SelectItem key={record.id} value={record.id}>
                {String(record.data[displayField] ?? record.id)}
              </SelectItem>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

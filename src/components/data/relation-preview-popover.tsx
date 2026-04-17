"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

const PREVIEW_SKIPPED_TYPES = new Set([
  "RELATION", "RELATION_SUBTABLE", "COUNT", "LOOKUP", "ROLLUP",
  "FORMULA", "AUTO_NUMBER", "SYSTEM_TIMESTAMP", "SYSTEM_USER",
]);

// Simple in-memory cache (per session, by recordId)
const recordCache = new Map<string, { data: DataRecordItem; timestamp: number }>();
const CACHE_TTL = 60_000; // 1 minute

interface RelationPreviewPopoverProps {
  recordId: string;
  tableId: string;
  displayValue: string;
  children: ReactNode;
  onNavigate?: (recordId: string) => void;
}

export function RelationPreviewPopover({
  recordId,
  tableId,
  displayValue,
  children,
  onNavigate,
}: RelationPreviewPopoverProps) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<DataRecordItem | null>(null);
  const [fields, setFields] = useState<DataFieldItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetchRef.current) return;
    fetchRef.current = true;

    // Check cache
    const cached = recordCache.get(recordId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setRecord(cached.data);
      setLoading(false);
      return;
    }

    try {
      const [recordRes, fieldsRes] = await Promise.all([
        fetch(`/api/data-tables/${tableId}/records/${recordId}`),
        fetch(`/api/data-tables/${tableId}/fields`),
      ]);
      if (recordRes.ok) {
        const rec = await recordRes.json();
        setRecord(rec);
        recordCache.set(recordId, { data: rec, timestamp: Date.now() });
      }
      if (fieldsRes.ok) {
        setFields(await fieldsRes.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [recordId, tableId]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchRef.current = false;
      fetchData();
    } else {
      fetchRef.current = false;
    }
  }, [open, fetchData]);

  const previewFields = fields
    .filter((f) => !PREVIEW_SKIPPED_TYPES.has(f.type) && !f.key.startsWith("_"))
    .slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-accent transition-colors"
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-64 p-3"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {loading ? (
          <div className="text-xs text-muted-foreground text-center py-2">加载中...</div>
        ) : record ? (
          <div className="space-y-2">
            <div className="font-medium text-sm truncate">{displayValue}</div>
            <div className="space-y-1">
              {previewFields.map((f) => {
                const val = record.data[f.key];
                return (
                  <div key={f.key} className="flex justify-between text-xs gap-2">
                    <span className="text-muted-foreground shrink-0">{f.label}</span>
                    <span className="truncate text-right">
                      {val != null && val !== "" ? String(val) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
            {onNavigate && (
              <button
                type="button"
                className="w-full text-xs text-blue-600 hover:underline pt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onNavigate(recordId);
                }}
              >
                查看详情
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-2">无法加载</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

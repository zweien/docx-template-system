"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import type { RelationTargetOption } from "@/components/data/relation-target-picker";

interface RelationCellEditorProps {
  value: string | { id: string; display?: string } | null;
  onCommit: (value: string | { id: string; display: string } | null) => void;
  onCancel: () => void;
  relationTableId?: string;
  displayField?: string;
}

export function RelationCellEditor({
  value,
  onCommit,
  onCancel,
  relationTableId,
  displayField,
}: RelationCellEditorProps) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<RelationTargetOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const committedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position using fixed positioning
  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left });
    }
  }, []);

  // Fetch options from API
  useEffect(() => {
    if (!relationTableId) return;

    const controller = new AbortController();
    async function fetchOptions() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (displayField) params.set("displayField", displayField);

        const res = await fetch(
          `/api/data-tables/${relationTableId}/relation-options?${params}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as RelationTargetOption[];
        setOptions(Array.isArray(data) ? data : []);
      } catch {
        // abort is fine
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    fetchOptions();
    return () => controller.abort();
  }, [relationTableId, displayField, search]);

  useEffect(() => {
    inputRef.current?.focus();
    updatePosition();
    setMounted(true);
  }, [updatePosition]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      const dropdown = document.getElementById("relation-dropdown-portal");
      if (dropdown?.contains(target)) return;
      if (committedRef.current) return;
      committedRef.current = true;
      onCancel();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onCancel]);

  const optionMap = useMemo(
    () => new Map(options.map((o) => [o.id, o])),
    [options]
  );

  const currentLabel = useMemo(() => {
    if (!value) return null;
    if (typeof value === "object") return (value as { display?: string }).display;
    return optionMap.get(value)?.label ?? value;
  }, [value, optionMap]);

  const rawId = useMemo(() => {
    if (!value) return null;
    if (typeof value === "object" && "id" in (value as object)) {
      return (value as { id: string }).id;
    }
    return String(value);
  }, [value]);

  function handleSelect(id: string, label: string) {
    committedRef.current = true;
    onCommit({ id, display: label });
  }

  function handleClear() {
    committedRef.current = true;
    onCommit(null);
  }

  // Fallback: plain text input when no relationTableId configured
  if (!relationTableId) {
    return (
      <Input
        value={rawId ?? ""}
        onChange={(e) => {}}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        onBlur={() => onCancel()}
        className="h-8 text-sm border-primary"
        placeholder="未配置关联表"
        readOnly
      />
    );
  }

  const filteredOptions = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const dropdown = isOpen && dropdownPos ? createPortal(
    <div
      id="relation-dropdown-portal"
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 9999,
      }}
      className="w-64 bg-background border rounded-md shadow-lg"
    >
      <div className="max-h-48 overflow-auto">
        {isLoading ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {search ? "无匹配结果" : "暂无记录"}
          </div>
        ) : (
          filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted truncate ${
                option.id === rawId ? "bg-muted font-medium" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(option.id, option.label);
              }}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            committedRef.current = true;
            onCancel();
          }
          if (e.key === "Backspace" && !search && rawId) {
            handleClear();
          }
        }}
        onFocus={updatePosition}
        className="h-8 text-sm border-primary pr-6"
        placeholder={rawId ? currentLabel ?? rawId : "搜索关联记录..."}
      />
      {rawId && !search && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs bg-muted px-1 rounded max-w-[calc(100%-2rem)] truncate pointer-events-none">
          {currentLabel ?? rawId}
        </span>
      )}
      {mounted && dropdown}
    </div>
  );
}

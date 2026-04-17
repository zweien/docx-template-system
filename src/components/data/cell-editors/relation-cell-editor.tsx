"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRelationOptions } from "@/hooks/use-relation-options";
import { RelationQuickCreateForm } from "@/components/data/relation-quick-create-form";

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
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [isOpen, setIsOpen] = useState(true);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const committedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    options,
    isLoading,
    isLoadingMore,
    hasMore,
    search,
    setSearch,
    sentinelRef,
    createRecord,
    isCreating,
    showCreateForm,
    setShowCreateForm,
    requiredFields,
  } = useRelationOptions({
    relationTableId: relationTableId ?? "",
    displayField,
  });

  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left });
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    updatePosition();
    setMounted(true);
  }, []);

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

  async function handleCreate(data: Record<string, unknown>) {
    const newOption = await createRecord(data);
    if (newOption) {
      committedRef.current = true;
      onCommit({ id: newOption.id, display: newOption.label });
    }
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
      {showCreateForm ? (
        <RelationQuickCreateForm
          fields={requiredFields}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isSubmitting={isCreating}
        />
      ) : (
        <>
          <div className="max-h-48 overflow-auto">
            {isLoading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">加载中...</div>
            ) : options.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                {search ? "无匹配结果" : "暂无记录"}
              </div>
            ) : (
              <>
                {options.map((option) => (
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
                ))}
                {hasMore && (
                  <div ref={sentinelRef} className="p-2 text-center text-xs text-muted-foreground">
                    {isLoadingMore ? "加载更多..." : ""}
                  </div>
                )}
              </>
            )}
          </div>
          {(rawId || isAdmin) && (
            <div className="border-t p-1 flex gap-1">
              {rawId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
                >
                  清除
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onMouseDown={(e) => { e.preventDefault(); setShowCreateForm(true); }}
                >
                  新建记录
                </Button>
              )}
            </div>
          )}
        </>
      )}
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

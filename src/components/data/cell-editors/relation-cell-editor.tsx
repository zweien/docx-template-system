"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useRelationOptions } from "@/hooks/use-relation-options";
import { RelationQuickCreateForm } from "@/components/data/relation-quick-create-form";

interface RelationCellEditorProps {
  value: string | { id: string; display?: string } | Array<{ id: string; display?: string }> | null;
  onCommit: (value: string | { id: string; display: string } | Array<{ id: string; display: string }> | null) => void;
  onCancel: () => void;
  relationTableId?: string;
  displayField?: string;
  multiSelect?: boolean;
  onOpenRecord?: (recordId: string) => void;
}

export function RelationCellEditor({
  value,
  onCommit,
  onCancel,
  relationTableId,
  displayField,
  multiSelect = false,
  onOpenRecord,
}: RelationCellEditorProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [isOpen] = useState(true);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const committedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build initial selected items from value prop (for multi-select initialization)
  const parsedInitialItems = useMemo(() => {
    if (!multiSelect || !value) return undefined;
    if (Array.isArray(value)) {
      return value
        .filter((v): v is { id: string; display?: string } => typeof v === "object" && "id" in v)
        .map((v) => ({ id: v.id, label: v.display ?? v.id }));
    }
    if (typeof value === "object" && "id" in value) {
      const v = value as { id: string; display?: string };
      return [{ id: v.id, label: v.display ?? v.id }];
    }
    return undefined;
  }, [multiSelect, value]);

  const {
    options,
    isLoading,
    isLoadingMore,
    hasMore,
    search,
    setSearch,
    sentinelRef,
    selectedIds: hookSelectedIds,
    toggleSelect,
    removeSelect,
    selectedItems,
    createRecord,
    isCreating,
    showCreateForm,
    setShowCreateForm,
    requiredFields,
  } = useRelationOptions({
    relationTableId: relationTableId ?? "",
    displayField,
    multiSelect,
    initialSelectedItems: parsedInitialItems,
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

  // Parse initial value(s) into a consistent format
  const initialIds = useMemo(() => {
    if (!value) return [] as string[];
    if (Array.isArray(value)) return value.map((v) => typeof v === "object" && "id" in v ? v.id : String(v));
    if (typeof value === "object") return [(value as { id: string }).id];
    return [String(value)];
  }, [value]);

  // For single-select: track the current raw ID
  const rawId = useMemo(() => {
    if (multiSelect) return null;
    return initialIds[0] ?? null;
  }, [multiSelect, initialIds]);

  const currentLabel = useMemo(() => {
    if (!rawId) return null;
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      return (value as { display?: string }).display;
    }
    return optionMap.get(rawId)?.label ?? rawId;
  }, [rawId, value, optionMap]);

  function handleSingleSelect(id: string, label: string) {
    committedRef.current = true;
    onCommit({ id, display: label });
  }

  function handleClear() {
    committedRef.current = true;
    onCommit(null);
  }

  function handleMultiCommit() {
    committedRef.current = true;
    if (selectedItems.length === 0) {
      onCommit(null);
    } else {
      onCommit(selectedItems.map((item) => ({ id: item.id, display: item.label })));
    }
  }

  async function handleCreate(data: Record<string, unknown>) {
    try {
      const newOption = await createRecord(data);
      if (newOption) {
        if (multiSelect) {
          // Auto-selected by hook, just update UI
        } else {
          committedRef.current = true;
          onCommit({ id: newOption.id, display: newOption.label });
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    }
  }

  // Fallback: plain text input when no relationTableId configured
  if (!relationTableId) {
    return (
      <Input
        value={rawId ?? ""}
        onChange={() => {}}
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

  // ── Multi-select mode ──
  if (multiSelect) {
    const dropdown = isOpen && dropdownPos ? createPortal(
      <div
        id="relation-dropdown-portal"
        style={{
          position: "fixed",
          top: dropdownPos.top,
          left: dropdownPos.left,
          zIndex: 9999,
        }}
        className="w-72 bg-background border rounded-md shadow-lg"
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
            <div className="max-h-52 overflow-auto">
              {isLoading ? (
                <div className="p-3 text-center text-sm text-muted-foreground">加载中...</div>
              ) : options.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  {search ? "无匹配结果" : "暂无记录"}
                </div>
              ) : (
                <>
                  {options.map((option) => {
                    const isSelected = hookSelectedIds.has(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2 ${
                          isSelected ? "bg-muted/50" : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          toggleSelect(option.id, option.label);
                        }}
                      >
                        <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                          isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                        }`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                  {hasMore && (
                    <div ref={sentinelRef} className="p-2 text-center text-xs text-muted-foreground">
                      {isLoadingMore ? "加载更多..." : ""}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="border-t p-1 flex gap-1">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onMouseDown={(e) => { e.preventDefault(); setShowCreateForm(true); }}
                >
                  + 新建记录
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-xs"
                onMouseDown={(e) => { e.preventDefault(); handleMultiCommit(); }}
              >
                确认
              </Button>
            </div>
          </>
        )}
      </div>,
      document.body
    ) : null;

    return (
      <div ref={containerRef} className="relative flex items-center gap-1 flex-wrap min-h-8 p-0.5">
        {selectedItems.length > 0 ? selectedItems.map((item) => (
          <Badge key={item.id} variant="secondary" className="gap-0.5 text-xs pr-0.5">
            {item.label}
            <button
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeSelect(item.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )) : null}
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              committedRef.current = true;
              onCancel();
            }
          }}
          onFocus={updatePosition}
          className="min-w-[80px] flex-1 text-sm outline-none bg-transparent border-none h-6 px-1"
          placeholder={selectedItems.length > 0 ? "搜索..." : "搜索关联记录..."}
        />
        {mounted && dropdown}
      </div>
    );
  }

  // ── Single-select mode ──
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
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2 ${
                      option.id === rawId ? "bg-muted font-medium" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSingleSelect(option.id, option.label);
                    }}
                  >
                    {onOpenRecord && option.id === rawId && (
                      <span
                        className="text-blue-600 hover:underline shrink-0"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onOpenRecord(option.id);
                          committedRef.current = true;
                          onCancel();
                        }}
                        title="查看详情"
                      >
                        {option.label}
                      </span>
                    )}
                    {(!onOpenRecord || option.id !== rawId) && (
                      <span className="truncate">{option.label}</span>
                    )}
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

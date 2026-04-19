"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useRelationOptions, type RelationOption } from "@/hooks/use-relation-options";
import { RelationQuickCreateForm } from "@/components/data/relation-quick-create-form";

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
  /** Enable multi-select mode */
  multiSelect?: boolean;
  /** Selected items in multi-select mode */
  valueMulti?: RelationTargetOption[];
  /** Callback for multi-select changes */
  onChangeMulti?: (items: RelationTargetOption[]) => void;
}

export function RelationTargetPicker({
  value,
  onChange,
  relationTableId,
  displayField,
  triggerId,
  placeholder = "选择目标记录",
  disabled = false,
  multiSelect = false,
  valueMulti: _valueMulti = [],
  onChangeMulti,
}: RelationTargetPickerProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [open, setOpen] = useState(false);

  const {
    options,
    isLoading,
    isLoadingMore,
    hasMore,
    search,
    setSearch,
    sentinelRef,
    selectedIds,
    toggleSelect,
    removeSelect,
    selectedItems,
    createRecord,
    isCreating,
    showCreateForm,
    setShowCreateForm,
    requiredFields,
  } = useRelationOptions({
    relationTableId,
    displayField,
    multiSelect,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setShowCreateForm(false);
    }
  }, [open, setSearch, setShowCreateForm]);

  // Sync multi-select external state
  useEffect(() => {
    if (multiSelect && onChangeMulti && open) {
      onChangeMulti(selectedItems);
    }
  }, [selectedItems, multiSelect, onChangeMulti, open]);

  const handleSingleSelect = (option: RelationOption) => {
    onChange({ id: option.id, label: option.label });
    setOpen(false);
  };

  const handleMultiSelect = (option: RelationOption) => {
    toggleSelect(option.id, option.label);
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    try {
      const newOption = await createRecord(data);
      if (newOption) {
        if (multiSelect) {
          // Already auto-selected by hook
        } else {
          onChange({ id: newOption.id, label: newOption.label });
          setOpen(false);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    }
  };

  const handleRemoveMulti = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSelect(id);
  };

  // Multi-select trigger with badges
  if (multiSelect) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              id={triggerId}
              ref={triggerRef}
              className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left"
              disabled={disabled || !relationTableId}
            />
          }
        >
          {selectedItems.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedItems.map((item) => (
              <Badge key={item.id} variant="secondary" className="gap-1 text-xs">
                {item.label}
                <button
                  type="button"
                  className="hover:text-destructive"
                  onClick={(e) => handleRemoveMulti(item.id, e)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--trigger-width)] p-0" style={{ minWidth: 200 }}>
          {showCreateForm ? (
            <RelationQuickCreateForm
              fields={requiredFields}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              isSubmitting={isCreating}
            />
          ) : (
            <>
              <div className="p-2 border-b">
                <Input
                  placeholder="搜索..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="max-h-60 overflow-auto">
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
                          selectedIds.has(option.id) ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => handleMultiSelect(option)}
                      >
                        <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                          selectedIds.has(option.id) ? "bg-primary border-primary" : "border-input"
                        }`}>
                          {selectedIds.has(option.id) && (
                            <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{option.label}</span>
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
              {isAdmin && (
                <div className="border-t p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => setShowCreateForm(true)}
                  >
                    新建记录
                  </Button>
                </div>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Single-select mode
  const currentOption = options.find((o) => o.id === value?.id);
  const selectedLabel = currentOption?.label ?? value?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            id={triggerId}
            ref={triggerRef}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left"
            disabled={disabled || !relationTableId}
          />
        }
      >
        {selectedLabel ? (
          <span className="truncate">{selectedLabel}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--trigger-width)] p-0" style={{ minWidth: 200 }}>
        {showCreateForm ? (
          <RelationQuickCreateForm
            fields={requiredFields}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            isSubmitting={isCreating}
          />
        ) : (
          <>
            <div className="p-2 border-b">
              <Input
                placeholder="搜索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-60 overflow-auto">
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
                        option.id === value?.id ? "bg-muted font-medium" : ""
                      }`}
                      onClick={() => handleSingleSelect(option)}
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
            {isAdmin && (
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => setShowCreateForm(true)}
                >
                  新建记录
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

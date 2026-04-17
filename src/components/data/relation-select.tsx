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
import { toast } from "sonner";
import { useRelationOptions, type RelationOption } from "@/hooks/use-relation-options";
import { RelationQuickCreateForm } from "@/components/data/relation-quick-create-form";

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
    createRecord,
    isCreating,
    showCreateForm,
    setShowCreateForm,
    requiredFields,
  } = useRelationOptions({
    relationTableId,
    displayField,
  });

  // Find current label
  const currentOption = options.find((o) => o.id === value);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Reset search when popover closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setShowCreateForm(false);
    }
  }, [open, setSearch, setShowCreateForm]);

  const handleSelect = (option: RelationOption) => {
    onChange(option.id);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    try {
      const newOption = await createRecord(data);
      if (newOption) {
        onChange(newOption.id);
        setOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            ref={triggerRef}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-left"
            disabled={disabled}
          />
        }
      >
        {currentOption ? (
          <span className="truncate">{currentOption.label}</span>
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
                        option.id === value ? "bg-muted font-medium" : ""
                      }`}
                      onClick={() => handleSelect(option)}
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
            {(value || isAdmin) && (
              <div className="border-t p-1 flex gap-1">
                {value && (
                  <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={handleClear}>
                    清除
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setShowCreateForm(true)}
                  >
                    新建记录
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

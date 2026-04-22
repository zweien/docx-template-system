"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Bookmark, ChevronDown, Filter, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { DataViewItem } from "@/types/data-table";

interface ViewSelectorProps {
  tableId: string;
  currentViewId: string | null;
  onViewChange: (viewId: string | null) => void;
  onSaveNewView: () => void;
}

export function ViewSelector({
  tableId,
  currentViewId,
  onViewChange,
  onSaveNewView,
}: ViewSelectorProps) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<DataViewItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tableId) return;
    let cancelled = false;

    async function fetchViews() {
      setLoading(true);
      try {
        const res = await fetch(`/api/data-tables/${tableId}/views`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success) {
          setViews(data.data);
        }
      } catch {
        // Silently fail - views are not critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchViews();
    return () => {
      cancelled = true;
    };
  }, [tableId, currentViewId]);

  const currentView = views.find((v) => v.id === currentViewId);

  const handleSelectView = (viewId: string | null) => {
    onViewChange(viewId);
    setOpen(false);
  };

  const handleSaveNew = () => {
    onSaveNewView();
    setOpen(false);
  };

  const handleDeleteView = async (e: React.MouseEvent, viewId: string, viewName: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/data-tables/${tableId}/views/${viewId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("删除视图失败");
        return;
      }
      setViews((prev) => prev.filter((v) => v.id !== viewId));
      if (currentViewId === viewId) {
        onViewChange(null);
      }
      toast.success(`已删除视图「${viewName}」`);
    } catch {
      toast.error("删除视图失败");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="min-w-[140px]" />
        }
      >
        <Bookmark className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {currentView?.name ?? "默认视图"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-56 border-[rgb(255_255_255_/_0.08)] bg-[#191a1b] p-1 text-[#d0d6e0]">
        {loading ? (
          <div className="px-2 py-3 text-center text-sm text-[#8a8f98]">
            加载中...
          </div>
        ) : (
          <>
            {/* Clear view */}
            <button
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[rgb(255_255_255_/_0.04)] ${
                currentViewId === null ? "bg-[rgb(113_112_255_/_0.14)] font-[510] text-[#f7f8f8]" : "text-[#d0d6e0]"
              }`}
              onClick={() => handleSelectView(null)}
            >
              <span className="w-4" />
              无视图
            </button>

            <Separator />

            {/* View list */}
            {views.map((view) => (
              <div
                key={view.id}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[rgb(255_255_255_/_0.04)] ${
                  view.id === currentViewId ? "bg-[rgb(113_112_255_/_0.14)] font-[510] text-[#f7f8f8]" : "text-[#d0d6e0]"
                }`}
                onClick={() => handleSelectView(view.id)}
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0 text-[#8a8f98]" />
                <span className="flex-1 truncate">{view.name}</span>
                <span className="flex gap-0.5 shrink-0">
                  {view.filters.length > 0 && (
                    <Filter className="h-3 w-3 text-[#8a8f98]" />
                  )}
                  {view.sortBy.length > 0 && (
                    view.sortBy[0].order === "asc" ? (
                      <ArrowUp className="h-3 w-3 text-[#8a8f98]" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-[#8a8f98]" />
                    )
                  )}
                </span>
                <button
                  className="shrink-0 rounded p-0.5 text-[#8a8f98] hover:text-[#ffc5c5]"
                  onClick={(e) => handleDeleteView(e, view.id, view.name)}
                  title="删除视图"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {views.length > 0 && <Separator />}

            {/* Save new view */}
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#7170ff] transition-colors hover:bg-[rgb(255_255_255_/_0.04)]"
              onClick={handleSaveNew}
            >
              <span className="w-4 text-center font-medium">+</span>
              新建视图
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

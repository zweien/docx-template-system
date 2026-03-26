"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bookmark, ChevronDown, Filter, ArrowUp, ArrowDown } from "lucide-react";
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
  }, [tableId]);

  const currentView = views.find((v) => v.id === currentViewId);

  const handleSelectView = (viewId: string | null) => {
    onViewChange(viewId);
    setOpen(false);
  };

  const handleSaveNew = () => {
    onSaveNewView();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="min-w-[120px]" />
        }
      >
        <Bookmark className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {currentView?.name ?? "默认视图"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 ml-auto" />
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-52 p-1">
        {loading ? (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            加载中...
          </div>
        ) : (
          <>
            {/* Clear view */}
            <button
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors ${
                currentViewId === null ? "font-medium" : ""
              }`}
              onClick={() => handleSelectView(null)}
            >
              <span className="w-4" />
              无视图
            </button>

            <Separator />

            {/* View list */}
            {views.map((view) => (
              <button
                key={view.id}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors ${
                  view.id === currentViewId ? "font-medium" : ""
                }`}
                onClick={() => handleSelectView(view.id)}
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{view.name}</span>
                <span className="flex gap-0.5 shrink-0">
                  {view.filters.length > 0 && (
                    <Filter className="h-3 w-3 text-muted-foreground" />
                  )}
                  {view.sortBy && (
                    view.sortBy.order === "asc" ? (
                      <ArrowUp className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    )
                  )}
                </span>
              </button>
            ))}

            {views.length > 0 && <Separator />}

            {/* Save new view */}
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-muted transition-colors"
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

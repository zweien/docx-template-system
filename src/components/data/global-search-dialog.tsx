"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Table2, X } from "lucide-react";

interface SearchResult {
  tableId: string;
  tableName: string;
  tableIcon: string | null;
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    matchedFields: string[];
  }>;
  totalMatches: number;
}

interface FlattenedItem {
  type: "record";
  tableId: string;
  tableName: string;
  tableIcon: string | null;
  recordId: string;
  data: Record<string, unknown>;
  matchedFields: string[];
}

export function GlobalSearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Flatten results for keyboard navigation
  const flatItems: FlattenedItem[] = results.flatMap((table) =>
    table.records.map((record) => ({
      type: "record" as const,
      tableId: table.tableId,
      tableName: table.tableName,
      tableIcon: table.tableIcon,
      recordId: record.id,
      data: record.data,
      matchedFields: record.matchedFields,
    }))
  );

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    // Auto-focus input when dialog opens
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query);
      setSelectedIndex(0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const handleSelect = useCallback(
    (item: FlattenedItem) => {
      router.push(`/data/${item.tableId}?recordId=${item.recordId}`);
      onClose();
    },
    [router, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatItems.length > 0) {
        e.preventDefault();
        handleSelect(flatItems[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [flatItems, selectedIndex, handleSelect, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-background border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索记录、表名..."
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              搜索中...
            </div>
          )}

          {!isLoading && query && flatItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              未找到匹配结果
            </div>
          )}

          {!isLoading &&
            !query && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                输入关键词开始搜索
              </div>
            )}

          {results.map((table) => {
            if (table.records.length === 0) return null;
            return (
              <div key={table.tableId}>
                <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                  {table.tableIcon ? (
                    <span className="text-sm">{table.tableIcon}</span>
                  ) : (
                    <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium text-muted-foreground">
                    {table.tableName}
                  </span>
                  {table.totalMatches > table.records.length && (
                    <span className="text-[10px] text-muted-foreground">
                      ({table.records.length}/{table.totalMatches})
                    </span>
                  )}
                </div>
                {table.records.map((record) => {
                  const flatIdx = flatItems.findIndex(
                    (f) => f.recordId === record.id && f.tableId === table.tableId
                  );
                  const isSelected = flatIdx === selectedIndex;
                  const label = getRecordLabel(record.data, record.matchedFields);

                  return (
                    <button
                      key={record.id}
                      className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm transition-colors ${
                        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      }`}
                      onClick={() =>
                        handleSelect({
                          type: "record",
                          tableId: table.tableId,
                          tableName: table.tableName,
                          tableIcon: table.tableIcon,
                          recordId: record.id,
                          data: record.data,
                          matchedFields: record.matchedFields,
                        })
                      }
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                    >
                      <span className="flex-1 truncate">
                        <span className="font-medium">{label}</span>
                        {record.matchedFields.length > 0 && (
                          <span className="ml-2 text-muted-foreground text-xs">
                            {record.matchedFields.join(", ")}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">↑</kbd>
            <kbd className="rounded border bg-muted px-1">↓</kbd>
            导航
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">↵</kbd>
            打开
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1">esc</kbd>
            关闭
          </span>
        </div>
      </div>
    </div>
  );
}

function getRecordLabel(
  data: Record<string, unknown>,
  matchedFields: string[]
): string {
  // Prefer the first matched field value as label
  for (const key of matchedFields) {
    const val = data[key];
    if (typeof val === "string" && val.trim()) return val;
  }
  // Fallback: first string field
  for (const val of Object.values(data)) {
    if (typeof val === "string" && val.trim()) return val;
  }
  return "未命名记录";
}

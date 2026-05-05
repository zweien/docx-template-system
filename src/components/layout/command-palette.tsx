"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  FileText,
  Table2,
  Inbox,
  BookOpen,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useCommands } from "@/hooks/use-command-palette";
import type { CommandItem } from "@/hooks/use-command-palette";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem as CmdItem,
  CommandShortcut,
} from "@/components/ui/command";

/* ---------- Types ---------- */

interface TemplateSearchItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  categoryName: string | null;
}

interface RecordSearchItem {
  id: string;
  fileName: string | null;
  templateName: string;
  status: string;
  createdAt: string;
}

interface DataRecordSearchResult {
  tableId: string;
  tableName: string;
  tableIcon: string | null;
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    matchedFields: string[];
  }>;
  hasMore: boolean;
}

interface CollectionTaskSearchItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

interface ReportTemplateSearchItem {
  id: string;
  name: string;
  originalFilename: string;
}

interface UnifiedSearchData {
  templates: TemplateSearchItem[];
  records: RecordSearchItem[];
  dataRecords: DataRecordSearchResult[];
  collectionTasks: CollectionTaskSearchItem[];
  reportTemplates: ReportTemplateSearchItem[];
}

/* ---------- Recent searches helpers ---------- */

const RECENT_KEY = "recent-searches";
const MAX_RECENT = 10;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  if (!query.trim()) return;
  const list = getRecentSearches().filter((s) => s !== query);
  list.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

function removeRecentSearch(query: string) {
  const list = getRecentSearches().filter((s) => s !== query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

/* ---------- Data record label helper ---------- */

function getRecordLabel(
  data: Record<string, unknown>,
  matchedFields: string[]
): string {
  for (const key of matchedFields) {
    const val = data[key];
    if (typeof val === "string" && val.trim()) return val;
  }
  for (const val of Object.values(data)) {
    if (typeof val === "string" && val.trim()) return val;
  }
  return "未命名记录";
}

/* ---------- Component ---------- */

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const commands = useCommands();
  const [query, setQuery] = useState("");
  const [searchData, setSearchData] = useState<UnifiedSearchData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isCommandMode = query.startsWith(">");
  const searchQuery = isCommandMode ? "" : query;
  const commandFilter = isCommandMode ? query.slice(1).trim() : "";

  // Load recent searches when dialog opens
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    } else {
      setQuery("");
      setSearchData(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || isCommandMode) {
      setSearchData(null);
      return;
    }
    if (!searchQuery.trim()) {
      setSearchData(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const json = await res.json();
          setSearchData(json.data ?? null);
        } else {
          toast.error("搜索失败");
          setSearchData(null);
        }
      } catch {
        toast.error("搜索失败，请检查网络连接");
        setSearchData(null);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, isCommandMode, open]);

  const handleClose = useCallback(() => {
    setQuery("");
    setSearchData(null);
    onClose();
  }, [onClose]);

  const handleSelectTemplate = useCallback(
    (id: string) => {
      handleClose();
      router.push(`/templates/${id}`);
    },
    [router, handleClose]
  );

  const handleSelectRecord = useCallback(
    (id: string) => {
      handleClose();
      router.push(`/records/${id}`);
    },
    [router, handleClose]
  );

  const handleSelectDataRecord = useCallback(
    (tableId: string, recordId: string) => {
      handleClose();
      router.push(`/data/${tableId}?recordId=${recordId}`);
    },
    [router, handleClose]
  );

  const handleSelectCollectionTask = useCallback(
    (id: string) => {
      handleClose();
      router.push(`/collections/${id}`);
    },
    [router, handleClose]
  );

  const handleSelectReportTemplate = useCallback(
    (id: string) => {
      handleClose();
      router.push(`/reports/templates/${id}`);
    },
    [router, handleClose]
  );

  const handleSelectRecentSearch = useCallback((q: string) => {
    setQuery(q);
  }, []);

  const handleRemoveRecentSearch = useCallback(
    (q: string, e: React.MouseEvent) => {
      e.stopPropagation();
      removeRecentSearch(q);
      setRecentSearches(getRecentSearches());
    },
    []
  );

  const handleCommandSelect = useCallback(
    (cmd: CommandItem) => {
      handleClose();
      cmd.onSelect();
    },
    [handleClose]
  );

  // Filter commands in command mode
  const filteredCommands = isCommandMode
    ? commands.filter((cmd) => {
        if (!commandFilter) return true;
        const lower = commandFilter.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(lower) ||
          cmd.id.toLowerCase().includes(lower) ||
          (cmd.keywords?.some((k) => k.toLowerCase().includes(lower)) ?? false)
        );
      })
    : [];

  // Check if there are any search results
  const hasResults =
    searchData &&
    ((searchData.templates?.length ?? 0) > 0 ||
      (searchData.records?.length ?? 0) > 0 ||
      (searchData.dataRecords?.length ?? 0) > 0 ||
      (searchData.collectionTasks?.length ?? 0) > 0 ||
      (searchData.reportTemplates?.length ?? 0) > 0);

  return (
    <CommandDialog
      title="命令面板"
      description="搜索或输入命令"
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <Command filter={(value, search) => {
        // In command mode, cmdk should not filter — we handle it ourselves
        if (search.startsWith(">")) return 1;
        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
      }}>
      <CommandInput
        placeholder={
          isCommandMode ? "输入命令名称..." : "搜索模板、记录、数据... 输入 > 切换命令模式"
        }
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Command mode */}
        {isCommandMode && (
          <>
            {filteredCommands.length === 0 && (
              <CommandEmpty>未找到匹配命令</CommandEmpty>
            )}
            <CommandGroup heading="导航">
              {filteredCommands.map((cmd) => (
                <CmdItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.id} ${(cmd.keywords ?? []).join(" ")}`}
                  onSelect={() => handleCommandSelect(cmd)}
                >
                  {cmd.icon}
                  <span>{cmd.label}</span>
                  {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
                </CmdItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Search mode: recent searches */}
        {!isCommandMode && !searchQuery.trim() && !isLoading && (
          <>
            {recentSearches.length === 0 && (
              <CommandEmpty>输入关键词开始搜索</CommandEmpty>
            )}
            {recentSearches.length > 0 && (
              <CommandGroup heading="最近搜索">
                {recentSearches.map((q) => (
                  <CmdItem
                    key={q}
                    value={`recent-${q}`}
                    onSelect={() => handleSelectRecentSearch(q)}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{q}</span>
                    <button
                      className="ml-auto p-0.5 rounded hover:bg-muted"
                      onClick={(e) => handleRemoveRecentSearch(q, e)}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </CmdItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {/* Search mode: loading */}
        {!isCommandMode && searchQuery.trim() && isLoading && (
          <CommandEmpty>搜索中...</CommandEmpty>
        )}

        {/* Search mode: no results */}
        {!isCommandMode &&
          searchQuery.trim() &&
          !isLoading &&
          !hasResults && (
            <CommandEmpty>未找到匹配结果</CommandEmpty>
          )}

        {/* Search mode: results */}
        {!isCommandMode &&
          searchData &&
          searchData.templates.length > 0 && (
            <CommandGroup heading="模板">
              {searchData.templates.map((t) => (
                <CmdItem
                  key={`tpl-${t.id}`}
                  value={`template-${t.id}-${t.name}`}
                  onSelect={() => handleSelectTemplate(t.id)}
                >
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{t.name}</span>
                    {t.categoryName && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        {t.categoryName}
                      </span>
                    )}
                  </span>
                </CmdItem>
              ))}
            </CommandGroup>
          )}

        {!isCommandMode &&
          searchData &&
          searchData.records.length > 0 && (
            <CommandGroup heading="生成记录">
              {searchData.records.map((r) => (
                <CmdItem
                  key={`rec-${r.id}`}
                  value={`record-${r.id}-${r.fileName ?? r.templateName}`}
                  onSelect={() => handleSelectRecord(r.id)}
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <span className="font-medium">
                      {r.fileName ?? r.templateName}
                    </span>
                    {r.fileName && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        {r.templateName}
                      </span>
                    )}
                  </span>
                </CmdItem>
              ))}
            </CommandGroup>
          )}

        {!isCommandMode &&
          searchData &&
          searchData.dataRecords.length > 0 &&
          searchData.dataRecords.map((table) => (
            <CommandGroup
              key={`data-${table.tableId}`}
              heading={table.tableName}
            >
              {table.records.map((record) => {
                const label = getRecordLabel(
                  record.data,
                  record.matchedFields
                );
                return (
                  <CmdItem
                    key={`datarec-${table.tableId}-${record.id}`}
                    value={`datarecord-${record.id}-${label}`}
                    onSelect={() =>
                      handleSelectDataRecord(table.tableId, record.id)
                    }
                  >
                    <Table2 className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">
                      <span className="font-medium">{label}</span>
                      {record.matchedFields.length > 0 && (
                        <span className="ml-2 text-muted-foreground text-xs">
                          {record.matchedFields.join(", ")}
                        </span>
                      )}
                    </span>
                  </CmdItem>
                );
              })}
            </CommandGroup>
          ))}

        {!isCommandMode &&
          searchData &&
          searchData.collectionTasks.length > 0 && (
            <CommandGroup heading="文档收集">
              {searchData.collectionTasks.map((t) => (
                <CmdItem
                  key={`col-${t.id}`}
                  value={`collection-${t.id}-${t.title}`}
                  onSelect={() => handleSelectCollectionTask(t.id)}
                >
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{t.title}</span>
                  </span>
                </CmdItem>
              ))}
            </CommandGroup>
          )}

        {!isCommandMode &&
          searchData &&
          searchData.reportTemplates.length > 0 && (
            <CommandGroup heading="报告模板">
              {searchData.reportTemplates.map((t) => (
                <CmdItem
                  key={`rpt-${t.id}`}
                  value={`report-${t.id}-${t.name}`}
                  onSelect={() => handleSelectReportTemplate(t.id)}
                >
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{t.name}</span>
                    {t.originalFilename && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        {t.originalFilename}
                      </span>
                    )}
                  </span>
                </CmdItem>
              ))}
            </CommandGroup>
          )}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}

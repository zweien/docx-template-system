"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton";

interface DataField {
  id: string;
  key: string;
  label: string;
  type: string;
}

interface DataRecordItem {
  id: string;
  data: Record<string, unknown>;
}

// Helper to format cell value - handles { id, display } objects for RELATION fields
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  // Handle { id, display } object format for RELATION fields
  if (typeof value === "object" && value !== null && "display" in value) {
    return String((value as Record<string, unknown>).display ?? "");
  }
  return String(value);
}

// Note: Uses placeholderId (not tableId) - API resolves to bound table
interface DataPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholderId: string;
  fields: DataField[];
  searchPlaceholder?: string;
  onSelect: (record: DataRecordItem) => void;
}

export function DataPickerDialog({
  open,
  onOpenChange,
  placeholderId,
  fields,
  searchPlaceholder = "搜索...",
  onSelect,
}: DataPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<DataRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load data when dialog opens or search/page changes
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "10",
        });
        if (search) params.set("search", search);

        const res = await fetch(`/api/placeholders/${placeholderId}/picker-data?${params}`);
        if (!res.ok) throw new Error("获取数据失败");

        const data = await res.json();
        setRecords(data.records);
        setTotal(data.total);
      } catch (error) {
        console.error("获取数据失败:", error);
        toast.error("获取数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, placeholderId, page, search]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setPage(1);
      setSelectedId(null);
    }
  }, [open]);

  const handleConfirm = () => {
    const selected = records.find((r) => r.id === selectedId);
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-lg">选择数据</DialogTitle>
        </DialogHeader>

        {/* Search - compact on mobile */}
        <div className="px-4 sm:px-6 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Content area - responsive scroll */}
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="px-4 sm:px-6 py-2">
              <TableSkeleton rows={5} columns={fields.length} />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-50" />
              <span>暂无数据</span>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-2">
              {/* Desktop: Table view */}
              <div className="hidden sm:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12"></TableHead>
                      {fields.slice(0, 5).map((field) => (
                        <TableHead key={field.id} className="font-medium">{field.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow
                        key={record.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          selectedId === record.id && "bg-primary/10 hover:bg-primary/15"
                        )}
                        onClick={() => setSelectedId(record.id)}
                      >
                        <TableCell>
                          <RadioGroup
                            value={selectedId ?? ""}
                            onValueChange={setSelectedId}
                          >
                            <RadioGroupItem
                              value={record.id}
                              aria-label={`选择 ${String(record.data[fields[0]?.key] ?? record.id)}`}
                            />
                          </RadioGroup>
                        </TableCell>
                        {fields.slice(0, 5).map((field) => (
                          <TableCell key={field.id} className="max-w-[200px] truncate">
                            {formatCellValue(record.data[field.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Card view */}
              <div className="sm:hidden space-y-2">
                {records.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      selectedId === record.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                        selectedId === record.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      )}>
                        {selectedId === record.id && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        {fields.slice(0, 3).map((field) => (
                          <div key={field.id} className="flex flex-col">
                            <span className="text-xs text-muted-foreground">{field.label}</span>
                            <span className="text-sm font-medium truncate">
                              {formatCellValue(record.data[field.key])}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {total > 10 && (
          <div className="px-4 sm:px-6 py-3 border-t bg-muted/30 shrink-0">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">共 {total} 条记录</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8"
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 10 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8"
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer - stacked on mobile */}
        <DialogFooter className="px-4 sm:px-6 py-4 border-t shrink-0 flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="w-full sm:w-auto"
          >
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

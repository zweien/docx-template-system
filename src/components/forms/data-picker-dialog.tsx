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
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>选择数据</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              暂无数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  {fields.slice(0, 5).map((field) => (
                    <TableHead key={field.id}>{field.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow
                    key={record.id}
                    className={selectedId === record.id ? "bg-muted" : "cursor-pointer"}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <TableCell>
                      <RadioGroup
                        value={selectedId ?? undefined}
                        onValueChange={setSelectedId}
                      >
                        <RadioGroupItem
                          value={record.id}
                          aria-label={`选择 ${String(record.data[fields[0]?.key] ?? record.id)}`}
                        />
                      </RadioGroup>
                    </TableCell>
                    {fields.slice(0, 5).map((field) => (
                      <TableCell key={field.id}>
                        {String(record.data[field.key] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {total > 10 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 条记录</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 10 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

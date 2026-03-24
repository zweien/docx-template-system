"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DataFieldItem, DataRecordItem, PaginatedRecords } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
}

export function RecordTable({ tableId, fields, isAdmin }: RecordTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaginatedRecords | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);

      const response = await fetch(`/api/data-tables/${tableId}/records?${params}`);
      const result = await response.json();

      if (response.ok) {
        setData(result);
      }
    } catch (error) {
      console.error("获取记录失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tableId, page, searchParams.get("search")]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    router.push(`/data/${tableId}?${params.toString()}`);
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("确定要删除这条记录吗？")) return;

    setDeletingId(recordId);
    try {
      const response = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("删除失败:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatCellValue = (field: DataFieldItem, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-zinc-400">-</span>;
    }

    switch (field.type) {
      case FieldType.NUMBER:
        return typeof value === "number" ? value.toLocaleString() : String(value);
      case FieldType.DATE:
        try {
          const date = new Date(value as string);
          return date.toLocaleDateString("zh-CN");
        } catch {
          return String(value);
        }
      case FieldType.SELECT:
        return <Badge variant="secondary">{String(value)}</Badge>;
      case FieldType.MULTISELECT:
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.map((v, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {v}
                </Badge>
              ))}
            </div>
          );
        }
        return String(value);
      case FieldType.EMAIL:
        return (
          <a
            href={`mailto:${value}`}
            className="text-blue-600 hover:underline"
          >
            {String(value)}
          </a>
        );
      case FieldType.PHONE:
        return <span className="font-mono">{String(value)}</span>;
      case FieldType.RELATION:
        // Display the resolved value if available
        const displayValue = (value as Record<string, unknown>)?.display ?? value;
        return <Badge variant="outline">{String(displayValue)}</Badge>;
      default:
        return String(value);
    }
  };

  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        请先配置字段
        {isAdmin && (
          <Link
            href={`/data/${tableId}/fields`}
            className="ml-2 text-blue-600 hover:underline"
          >
            前往配置
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex-1 max-w-sm">
          <Input
            placeholder="搜索记录..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </form>
        {isAdmin && (
          <div className="flex gap-2">
            <Link href={`/data/${tableId}/new`}>
              <Button size="sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
                  <line x1="12" x2="12" y1="5" y2="19" />
                  <line x1="5" x2="19" y1="12" y2="12" />
                </svg>
                新建记录
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {fields.slice(0, 6).map((field) => (
                <TableHead key={field.id}>{field.label}</TableHead>
              ))}
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={fields.length + 1} className="text-center py-8">
                  加载中...
                </TableCell>
              </TableRow>
            ) : !data || data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={fields.length + 1} className="text-center py-8">
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  {fields.slice(0, 6).map((field) => (
                    <TableCell key={field.id} className="max-w-[200px] truncate">
                      {formatCellValue(field, record.data[field.key])}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex gap-1">
                      {isAdmin && (
                        <>
                          <Link href={`/data/${tableId}/${record.id}/edit`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              编辑
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600"
                            onClick={() => handleDelete(record.id)}
                            disabled={deletingId === record.id}
                          >
                            {deletingId === record.id ? "删除中..." : "删除"}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            共 {data.total} 条记录
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/data/${tableId}?page=${page - 1}${search ? `&search=${search}` : ""}`}>
                <Button variant="outline" size="sm">上一页</Button>
              </Link>
            )}
            {page < data.totalPages && (
              <Link href={`/data/${tableId}?page=${page + 1}${search ? `&search=${search}` : ""}`}>
                <Button variant="outline" size="sm">下一页</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

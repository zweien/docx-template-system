"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bot } from "lucide-react";
import { RecordTable } from "@/components/data/record-table";
import type { DataTableDetail } from "@/types/data-table";

interface TableDetailContentProps {
  tableId: string;
  table: DataTableDetail;
  isAdmin: boolean;
}

export function TableDetailContent({ tableId, table, isAdmin }: TableDetailContentProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
            <Link href="/data" className="hover:underline">主数据</Link>
            <span>/</span>
            <span>{table.name}</span>
          </div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {table.icon && <span>{table.icon}</span>}
            {table.name}
          </h1>
          {table.description && (
            <p className="text-zinc-500 mt-1">{table.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/ai-agent?tableId=${tableId}`}>
            <Button variant="outline" size="sm">
              <Bot className="h-4 w-4 mr-2" />
              AI 助手
            </Button>
          </Link>

          {isAdmin && (
            <>
              <Link href={`/data/${tableId}/import`}>
                <Button variant="outline" size="sm">
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  导入
                </Button>
              </Link>
              <Link href={`/data/${tableId}/fields`}>
                <Button variant="outline" size="sm">
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
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <line x1="3" x2="21" y1="9" y2="9" />
                    <line x1="9" x2="9" y1="21" y2="9" />
                  </svg>
                  配置字段
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1 text-zinc-500">
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
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <line x1="3" x2="21" y1="9" y2="9" />
            <line x1="9" x2="9" y1="21" y2="9" />
          </svg>
          {table.fieldCount} 个字段
        </div>
        <div className="flex items-center gap-1 text-zinc-500">
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
          >
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
          </svg>
          {table.recordCount} 条记录
        </div>
      </div>

      <Separator />

      {/* Record Table */}
      <RecordTable tableId={tableId} fields={table.fields} isAdmin={isAdmin} />
    </div>
  );
}

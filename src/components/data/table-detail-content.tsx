"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { RecordTable } from "@/components/data/record-table";
import { RecordDetailDrawer } from "@/components/data/record-detail-drawer";
import { ChatArea } from "@/components/agent2/chat-area";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import type { DataTableDetail } from "@/types/data-table";

interface TableDetailContentProps {
  tableId: string;
  table: DataTableDetail;
  isAdmin: boolean;
}

export function TableDetailContent({ tableId, table, isAdmin }: TableDetailContentProps) {
  const searchParams = useSearchParams();
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [recordIds, setRecordIds] = useState<string[]>([]);

  // Auto-open record detail from search params
  useEffect(() => {
    const rid = searchParams.get("recordId");
    if (rid) {
      setDetailRecordId(rid);
      setDetailOpen(true);
    }
  }, [searchParams]);

  // AI Sheet state
  const [aiOpen, setAiOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleAiOpen = useCallback(() => {
    if (!aiOpen) {
      // Opening: create new conversation
      void fetch("/api/agent2/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `数据表: ${table.name}` }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.success) {
            setConversationId(data.data.id);
            setAiOpen(true);
          }
        })
        .catch(() => {
          toast.error("创建会话失败，请稍后重试");
        });
    }
  }, [aiOpen, table.name]);

  const handleAiClose = useCallback((open: boolean) => {
    if (!open) {
      setAiOpen(false);
      setConversationId(null);
    }
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card/70 p-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/data" className="hover:text-foreground">主数据</Link>
            <span>/</span>
            <span>{table.name}</span>
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-[510] tracking-[-0.7px] text-foreground">
            {table.icon && <span>{table.icon}</span>}
            {table.name}
          </h1>
          {table.description && (
            <p className="mt-1 text-muted-foreground">{table.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAiOpen}>
            <Bot className="h-4 w-4 mr-2" />
            AI 助手
          </Button>

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

      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
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
          <div className="flex items-center gap-1 text-muted-foreground">
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
      </div>

      <Separator />

      <RecordTable
        tableId={tableId}
        fields={table.fields}
        isAdmin={isAdmin}
        onOpenDetail={(recordId) => {
          setDetailRecordId(recordId);
          setDetailOpen(true);
        }}
        onRecordIdsChange={setRecordIds}
      />

      <RecordDetailDrawer
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailOpen(false);
            setDetailRecordId(null);
          }
        }}
        recordId={detailRecordId}
        tableId={tableId}
        fields={table.fields}
        isAdmin={isAdmin}
        recordIds={recordIds}
        onNavigate={(id) => setDetailRecordId(id)}
      />

      <Sheet open={aiOpen} onOpenChange={handleAiClose}>
        <SheetContent side="right" className="sm:max-w-lg w-full p-0" showCloseButton={false}>
          {conversationId && (
            <ChatArea
              conversationId={conversationId}
              tableId={tableId}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

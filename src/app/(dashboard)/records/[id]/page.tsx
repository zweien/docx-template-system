import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, RotateCcw, Copy, FileSpreadsheet } from "lucide-react";
import type { Role, RecordStatus } from "@/generated/prisma/enums";
import { RetryButton } from "./retry-button";
import { CopyToDraftButton } from "./copy-to-draft-button";

const STATUS_LABELS: Record<RecordStatus, string> = {
  PENDING: "待生成",
  COMPLETED: "已完成",
  FAILED: "失败",
};

const STATUS_VARIANTS: Record<
  RecordStatus,
  "secondary" | "default" | "destructive"
> = {
  PENDING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
};

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const record = await db.record.findUnique({
    where: { id },
    include: {
      template: {
        select: {
          name: true,
          placeholders: { select: { key: true, label: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!record) {
    notFound();
  }

  // Verify ownership or admin
  const isAdmin = (session?.user?.role as Role) === "ADMIN";
  if (record.userId !== session?.user?.id && !isAdmin) {
    notFound();
  }

  const formData = record.formData as Record<string, unknown>;

  // Build key → label mapping from template placeholders
  const labelMap = new Map<string, string>();
  for (const ph of record.template.placeholders) {
    labelMap.set(ph.key, ph.label);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/records" />}
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Button>

      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">记录详情</h1>
          <p className="text-muted-foreground">
            {record.template.name}
          </p>
        </div>
        <Badge
          variant={STATUS_VARIANTS[record.status as RecordStatus]}
          className="text-sm px-3 py-1"
        >
          {STATUS_LABELS[record.status as RecordStatus]}
        </Badge>
      </div>

      <Separator />

      {/* Info section */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">模板名称</span>
            <span>{record.template.name}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">生成时间</span>
            <span>
              {record.createdAt.toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {record.fileName && (
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground">文件名</span>
              <span>{record.fileName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form data snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>表单数据</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(formData).length === 0 ? (
            <p className="text-sm text-muted-foreground">（无表单数据）</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(formData).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {labelMap.get(key) || key}
                  </p>
                  <p className="text-sm bg-muted rounded-md px-3 py-2 break-all">
                    {String(value || "")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {record.status === "COMPLETED" && record.fileName && (
            <a
              href={`/uploads/documents/${record.fileName}`}
              download={record.fileName}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors"
            >
              <Download className="h-4 w-4" />
              下载文档
            </a>
          )}

          {record.status === "FAILED" && (
            <div className="space-y-3">
              {record.errorMessage && (
                <div className="rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm">
                  错误信息：{record.errorMessage}
                </div>
              )}
              <RetryButton recordId={record.id} />
            </div>
          )}

          <CopyToDraftButton recordId={record.id} />

          <a
            href={`/api/records/${record.id}/export`}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            导出 Excel
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

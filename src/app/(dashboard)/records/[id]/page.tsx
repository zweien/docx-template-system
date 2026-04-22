import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
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
          placeholders: { select: { key: true, label: true, inputType: true, columns: true }, orderBy: { sortOrder: "asc" } },
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

  // Build key → placeholder info mapping from template placeholders
  const labelMap = new Map<string, string>();
  const placeholderInfoMap = new Map<string, { inputType: string; columns?: unknown }>();
  for (const ph of record.template.placeholders) {
    labelMap.set(ph.key, ph.label);
    placeholderInfoMap.set(ph.key, { inputType: ph.inputType, columns: ph.columns });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <LinkButton
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground"
        href="/records"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </LinkButton>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.03)]">
        <div>
          <h1 className="text-3xl font-[510] tracking-[-0.7px] text-foreground">记录详情</h1>
          <p className="text-sm text-muted-foreground">
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

      <Separator className="bg-border" />

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">模板名称</span>
            <span className="text-foreground">{record.template.name}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
            <span className="text-muted-foreground">生成时间</span>
            <span className="text-foreground">
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
              <span className="text-foreground">{record.fileName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>表单数据</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(formData).length === 0 ? (
            <p className="text-sm text-muted-foreground">（无表单数据）</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(formData).map(([key, value]) => {
                const phInfo = placeholderInfoMap.get(key);
                const isTable =
                  phInfo?.inputType === "TABLE" &&
                  Array.isArray(value) &&
                  value.every((item) => typeof item === "object" && item !== null);
                const isChoiceArray =
                  Array.isArray(value) &&
                  value.every((item) => typeof item === "string");

                return (
                  <div key={key} className={isTable ? "md:col-span-2" : ""}>
                    <p className="mb-1 text-xs font-[510] text-muted-foreground">
                      {labelMap.get(key) || key}
                    </p>
                    {isTable ? (
                      (value as Record<string, string>[]).length === 0 ? (
                        <p className="text-sm text-muted-foreground">（空表格）</p>
                      ) : (
                        <div className="overflow-hidden rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {(phInfo.columns as Array<{ key: string; label: string }> | undefined)?.map?.((col) => (
                                  <TableHead key={col.key}>{col.label}</TableHead>
                                )) ?? (
                                  Object.keys((value as Record<string, string>[])[0]).map((colKey) => (
                                    <TableHead key={colKey}>{colKey}</TableHead>
                                  ))
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(value as Record<string, string>[]).map((row, i) => (
                                <TableRow key={i}>
                                  {(phInfo.columns as Array<{ key: string; label: string }> | undefined)?.map?.((col) => (
                                    <TableCell key={col.key}>{row[col.key] ?? ""}</TableCell>
                                  )) ?? (
                                    Object.keys(row).map((colKey) => (
                                      <TableCell key={colKey}>{row[colKey] ?? ""}</TableCell>
                                    ))
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )
                    ) : (
                      <p className="break-all rounded-md border border-border bg-card px-3 py-2 text-sm text-secondary-foreground">
                        {isChoiceArray ? value.join("、") : String(value || "")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {record.status === "COMPLETED" && record.fileName && (
            <a
              href={`/api/records/${record.id}/download`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-[510] text-primary-foreground transition-colors hover:bg-[#828fff]"
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
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-[510] text-secondary-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
          >
            <FileSpreadsheet className="h-4 w-4" />
            导出 Excel
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

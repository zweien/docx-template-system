import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role, TemplateStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Pencil,
  FileText,
  Files,
  PenLine,
  CalendarDays,
  User,
  HardDrive,
} from "lucide-react";
import { DeleteTemplateButton } from "./delete-button";
import { DataTableLinkWrapper } from "@/components/template/data-table-link-wrapper";
import { VersionHistoryDialogWrapper } from "./version-history-wrapper";
import { PlaceholderEditButton } from "./placeholder-edit-wrapper";
import { getPlaceholderInputTypeLabel } from "@/lib/placeholder-input-type";

const STATUS_LABELS: Record<TemplateStatus, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

const STATUS_VARIANTS: Record<
  TemplateStatus,
  "secondary" | "default" | "destructive"
> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  ARCHIVED: "destructive",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const template = await db.template.findUnique({
    where: { id },
    include: {
      placeholders: {
        orderBy: { sortOrder: "asc" },
      },
      createdBy: {
        select: { name: true },
      },
      // P2: 包含关联的数据表
      dataTable: {
        select: { id: true, name: true },
      },
      currentVersion: {
        select: {
          id: true,
          version: true,
          publishedAt: true,
          publishedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!template) {
    notFound();
  }

  const isAdmin = (session?.user?.role as Role) === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/templates" />}
      >
        <ArrowLeft className="h-4 w-4" />
        返回模板列表
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {template.name}
            </h1>
            <Badge variant={STATUS_VARIANTS[template.status]}>
              {STATUS_LABELS[template.status]}
            </Badge>
            {template.currentVersion && (
              <Badge variant="outline">v{template.currentVersion.version}</Badge>
            )}
          </div>
          {template.description && (
            <p className="text-muted-foreground">{template.description}</p>
          )}
        </div>

        {/* Action buttons — icon-only on mobile, icon+text on sm+ */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {template.currentVersion && (
            <VersionHistoryDialogWrapper templateId={template.id} />
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/templates/${template.id}/edit`} />}
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">编辑</span>
            </Button>
          )}
          {template.status === "PUBLISHED" && (
            <>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/templates/${template.id}/batch`} />}
              >
                <Files className="h-4 w-4" />
                <span className="hidden sm:inline">批量生成</span>
              </Button>
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href={`/templates/${template.id}/fill`} />}
              >
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">填写表单</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">文件信息</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{template.originalFileName || template.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(template.fileSize)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">创建者</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{template.createdBy.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">创建时间</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {template.createdAt.toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">占位符数量</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {template.placeholders.length} 个
            </p>
          </CardContent>
        </Card>
      </div>

      {/* P2: 主数据关联 */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>主数据关联</CardTitle>
            <CardDescription>
              关联数据表后，批量生成时可自动选择该表并配置字段映射
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTableLinkWrapper
              templateId={template.id}
              dataTableId={template.dataTableId}
              dataTable={template.dataTable}
              fieldMapping={template.fieldMapping as Record<string, string | null> | null}
              placeholders={template.placeholders.map((ph) => ({
                key: ph.key,
                label: ph.label,
                required: ph.required,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Placeholders table */}
      <Card>
        <CardHeader>
          <CardTitle>占位符列表</CardTitle>
          <CardDescription>
            模板中定义的所有占位符字段
          </CardDescription>
        </CardHeader>
        <CardContent>
          {template.placeholders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">暂无占位符</p>
              {isAdmin && (
                <Button
                  variant="link"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/templates/${template.id}/edit`} />
                  }
                >
                  前往配置
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>键名</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>输入类型</TableHead>
                    <TableHead>必填</TableHead>
                    <TableHead>排序</TableHead>
                    {isAdmin && <TableHead className="text-right">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {template.placeholders.map((ph) => (
                    <TableRow key={ph.id}>
                      <TableCell className="font-mono text-sm">
                        {ph.key}
                      </TableCell>
                      <TableCell>{ph.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {ph.description || "—"}
                      </TableCell>
                      <TableCell>
                        {getPlaceholderInputTypeLabel(ph.inputType)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ph.required ? "default" : "secondary"}>
                          {ph.required ? "是" : "否"}
                        </Badge>
                      </TableCell>
                      <TableCell>{ph.sortOrder}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <PlaceholderEditButton placeholder={ph} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      {isAdmin && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">危险操作</CardTitle>
            <CardDescription>
              以下操作不可撤销，请谨慎执行
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">删除模板</p>
                <p className="text-xs text-muted-foreground">
                  删除后将同时移除所有关联的占位符、草稿和生成记录
                </p>
              </div>
              <DeleteTemplateButton templateId={template.id} templateName={template.name} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

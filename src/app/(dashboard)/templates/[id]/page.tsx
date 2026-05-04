import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role, TemplateStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  FileText,
  Files,
  PenLine,
  CalendarDays,
  User,
  HardDrive,
} from "lucide-react";
import { Breadcrumbs, PageHeader, ContentCard } from "@/components/shared";
import { DeleteTemplateButton } from "./delete-button";
import { TemplateDownloadButton } from "./download-button";
import { DataTableLinkWrapper } from "@/components/template/data-table-link-wrapper";
import { VersionHistoryDialogWrapper } from "./version-history-wrapper";
import { PlaceholderEditButton } from "./placeholder-edit-wrapper";
import { getPlaceholderInputTypeLabel } from "@/lib/placeholder-input-type";
import { ScreenshotViewer } from "@/components/templates/screenshot-viewer";
import { FillAssistPromptEditor } from "@/components/templates/fill-assist-prompt-editor";

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
      <Breadcrumbs items={[
        { label: "模板管理", href: "/templates" },
        { label: template.name },
      ]} />

      <PageHeader
        title={template.name}
        description={template.description || undefined}
        actions={
          <>
            <Badge variant={STATUS_VARIANTS[template.status]}>
              {STATUS_LABELS[template.status]}
            </Badge>
            {template.currentVersion && (
              <Badge variant="outline">v{template.currentVersion.version}</Badge>
            )}
            {template.currentVersion && (
              <VersionHistoryDialogWrapper templateId={template.id} />
            )}
            {isAdmin && (
              <LinkButton
                variant="outline"
                size="sm"
                href={`/templates/${template.id}/edit`}
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">编辑</span>
              </LinkButton>
            )}
            {template.status === "PUBLISHED" && (
              <>
                <LinkButton
                  variant="outline"
                  size="sm"
                  href={`/templates/${template.id}/batch`}
                >
                  <Files className="h-4 w-4" />
                  <span className="hidden sm:inline">批量生成</span>
                </LinkButton>
                <LinkButton
                  size="sm"
                  href={`/templates/${template.id}/fill`}
                >
                  <PenLine className="h-4 w-4" />
                  <span className="hidden sm:inline">填写表单</span>
                </LinkButton>
              </>
            )}
          </>
        }
      />

      {template.screenshot && (
        <div className="max-w-xs">
          <ScreenshotViewer src={template.screenshot} alt={template.name} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ContentCard>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">文件信息</span>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{template.originalFileName || template.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(template.fileSize)}
            </p>
            <TemplateDownloadButton templateId={template.id} />
          </div>
        </ContentCard>

        <ContentCard>
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">创建者</span>
          </div>
          <p className="text-sm font-medium text-foreground">{template.createdBy.name}</p>
        </ContentCard>

        <ContentCard>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">创建时间</span>
          </div>
          <p className="text-sm font-medium text-foreground">
            {template.createdAt.toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </p>
        </ContentCard>

        <ContentCard>
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">占位符数量</span>
          </div>
          <p className="text-sm font-medium text-foreground">
            {template.placeholders.length} 个
          </p>
        </ContentCard>
      </div>

      {isAdmin && (
        <ContentCard>
          <h3 className="text-sm font-medium mb-1">主数据关联</h3>
          <p className="text-sm text-muted-foreground mb-4">
            关联数据表后，批量生成时可自动选择该表并配置字段映射
          </p>
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
        </ContentCard>
      )}

      {isAdmin && (
        <ContentCard>
          <h3 className="text-sm font-medium mb-1">AI 填充助手配置</h3>
          <p className="text-sm text-muted-foreground mb-4">
            为此模板配置专属的 AI 填充提示词，指导 AI 助手在用户填表时生成更精准的建议
          </p>
          <FillAssistPromptEditor
            templateId={template.id}
            initialValue={template.fillAssistPrompt}
          />
        </ContentCard>
      )}

      <ContentCard>
        <h3 className="text-sm font-medium mb-1">占位符列表</h3>
        <p className="text-sm text-muted-foreground mb-4">
          模板中定义的所有占位符字段
        </p>
          {template.placeholders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">暂无占位符</p>
              {isAdmin && (
                <LinkButton
                  variant="link"
                  size="sm"
                  href={`/templates/${template.id}/edit`}
                >
                  前往配置
                </LinkButton>
              )}
            </div>
          ) : (
            <div>
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
                      <TableCell className="font-mono text-sm text-secondary-foreground">
                        {ph.key}
                      </TableCell>
                      <TableCell>{ph.label}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
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
      </ContentCard>

      {isAdmin && (
        <ContentCard className="border-destructive/45">
          <h3 className="text-sm font-medium text-destructive mb-1">危险操作</h3>
          <p className="text-sm text-muted-foreground mb-4">
            以下操作不可撤销，请谨慎执行
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">删除模板</p>
              <p className="text-xs text-muted-foreground">
                删除后将同时移除所有关联的占位符、草稿和生成记录
              </p>
            </div>
            <DeleteTemplateButton templateId={template.id} templateName={template.name} />
          </div>
        </ContentCard>
      )}
    </div>
  );
}

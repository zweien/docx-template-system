"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Download, Trash2, Upload, FileArchive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SourceFile {
  fileName: string;
  fileSize: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DownloadTemplateFilesProps {
  templateId: string;
  isAdmin: boolean;
  isPublished: boolean;
}

export function DownloadTemplateFiles({
  templateId,
  isAdmin,
  isPublished,
}: DownloadTemplateFilesProps) {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/templates/${templateId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = e.target.files;
    if (!incoming || incoming.length === 0) return;
    if (inputRef.current) inputRef.current.value = "";

    setUploading(true);
    try {
      for (const file of Array.from(incoming)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/templates/${templateId}/files`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          toast.error(`上传 ${file.name} 失败：${err?.error?.message || "未知错误"}`);
          break;
        }
      }
      toast.success("文件上传成功");
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`确定删除文件「${fileName}」吗？`)) return;
    try {
      const res = await fetch(`/api/templates/${templateId}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      if (res.ok) {
        toast.success("文件已删除");
        await refresh();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium mb-1">文件清单</h3>
          <p className="text-sm text-muted-foreground">
            下载型模板包含的全部文件{isAdmin ? "（管理员可增删）" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/templates/${templateId}/download`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#828fff]"
          >
            <Download className="h-4 w-4" />
            下载全部 (zip)
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          加载中...
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
          <FileArchive className="h-8 w-8" />
          <p className="text-sm">
            {isAdmin ? "尚未上传任何文件" : "该模板暂无文件"}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>文件名</TableHead>
              <TableHead className="w-32">大小</TableHead>
              <TableHead className="w-32 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f) => (
              <TableRow key={f.fileName}>
                <TableCell className="font-medium text-sm">
                  {f.fileName}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatFileSize(f.fileSize)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={`/api/templates/${templateId}/files/${encodeURIComponent(f.fileName)}`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Download className="h-3 w-3" />
                      下载
                    </a>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(f.fileName)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {isAdmin && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || isPublished}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "上传中..." : "添加文件"}
          </Button>
          {isPublished && (
            <p className="text-xs text-muted-foreground">
              已发布的模板暂不支持增删文件，如需修改请先撤销发布
            </p>
          )}
        </>
      )}
    </div>
  );
}

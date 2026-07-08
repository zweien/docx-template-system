"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { ScreenshotViewer } from "./screenshot-viewer";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

interface ScreenshotManagerProps {
  templateId: string;
  initialScreenshot: string | null;
  templateName: string;
}

/**
 * 模板截图管理：管理员可上传/删除截图，非管理员只读查看（走 ScreenshotViewer）。
 * 用于详情页，两种模板类型通用。
 */
export function ScreenshotManager({
  templateId,
  initialScreenshot,
  templateName,
}: ScreenshotManagerProps) {
  const [screenshot, setScreenshot] = useState<string | null>(initialScreenshot);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 支持粘贴上传图片
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            uploadFile(file);
            break;
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templateId]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const uploadFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("仅支持 png, jpg, jpeg, webp, gif 格式");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("screenshot", file);
      const res = await fetch(`/api/templates/${templateId}/screenshot`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || "上传截图失败");
        return;
      }
      const data = await res.json();
      setScreenshot(data.data.path);
      toast.success("截图已更新");
      router.refresh();
    } catch {
      toast.error("上传截图失败");
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!confirm("确定删除该截图吗？")) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/screenshot`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error?.message || "删除失败");
        return;
      }
      setScreenshot(null);
      toast.success("截图已删除");
      router.refresh();
    } catch {
      toast.error("删除失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {screenshot ? (
        <div className="relative max-w-xs">
          <ScreenshotViewer src={screenshot} alt={templateName} />
          <button
            type="button"
            onClick={handleDelete}
            disabled={uploading}
            className="absolute top-2 right-2 rounded-md bg-background/80 p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="删除截图"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full max-w-xs flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-muted-foreground transition-colors hover:border-muted-foreground/50"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
          <span className="text-xs">
            {uploading ? "上传中..." : "点击或粘贴上传截图（可选）"}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

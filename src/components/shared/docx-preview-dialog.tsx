"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// file-viewer 依赖浏览器 API（Worker/DOM），仅在客户端按需加载
const FileViewer = dynamic(
  () => import("@file-viewer/react-full").then((m) => m.FileViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        正在加载预览组件...
      </div>
    ),
  }
);

interface DocxPreviewDialogProps {
  /** 不带 query 的下载地址，组件会自动追加 ?inline=1 */
  url: string;
  filename?: string;
  /** 按钮文案，默认「预览」 */
  label?: string;
  /** 按钮尺寸 */
  size?: "default" | "sm" | "xs" | "icon" | "icon-sm";
  /** 按钮变体，默认 outline */
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
}

export function DocxPreviewDialog({
  url,
  filename,
  label = "预览",
  size = "sm",
  variant = "outline",
}: DocxPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  // 强制 docx 走主线程解析，规避 worker/WASM 静态资源与 Turbopack 打包问题
  const viewerOptions = {
    docx: { worker: false },
  };

  const previewUrl = url.includes("?")
    ? `${url}&inline=1`
    : `${url}?inline=1`;

  const handleStateChange = useCallback(
    (state: { loading: boolean; ready: boolean; error: unknown | null }) => {
      if (state.loading) {
        setLoading(true);
        setErrored(false);
      } else if (state.error) {
        setLoading(false);
        setErrored(true);
        toast.error("预览加载失败");
        setOpen(false);
      } else if (state.ready) {
        setLoading(false);
        setErrored(false);
      }
    },
    []
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setLoading(true);
          setErrored(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant={variant} size={size} className="gap-1.5">
            <Eye className="h-4 w-4" />
            {label}
          </Button>
        }
      />
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-2 p-4">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="truncate">
            {filename || "文档预览"}
          </DialogTitle>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-white">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
              正在加载预览...
            </div>
          )}
          {!errored && (
            <FileViewer
              url={previewUrl}
              filename={filename}
              options={viewerOptions}
              onStateChange={handleStateChange}
              className="h-full w-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

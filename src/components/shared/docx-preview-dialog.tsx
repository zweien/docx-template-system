"use client";

import { useState, useCallback, useRef } from "react";
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
import { officeRenderers } from "@file-viewer/preset-office";

// file-viewer 依赖浏览器 API（Worker/DOM），仅在客户端按需加载。
// 用 preset-office（仅 word/pdf/spreadsheet/presentation/ofd），避免 preset-all
// 中的 mindmap renderer 经由 @ljheee/xmind-parser 引入 fs/promises 污染浏览器 bundle。
const FileViewer = dynamic(
  () => import("@file-viewer/react").then((m) => m.FileViewer),
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
  // 标记本次加载是否已渲染出内容；docx 流式渲染时 loading 会反复跳动，
  // 一旦渲染过就不再重新显示遮罩，避免遮罩卡住盖住已渲染的内容。
  const renderedRef = useRef(false);

  // 强制 docx 走主线程解析，规避 worker/WASM 静态资源与 Turbopack 打包问题
  const viewerOptions = {
    preset: officeRenderers,
    autoRenderers: true,
    docx: { worker: false },
  };

  const previewUrl = url.includes("?")
    ? `${url}&inline=1`
    : `${url}?inline=1`;

  const handleStateChange = useCallback(
    (state: { loading: boolean; ready: boolean; error: unknown | null }) => {
      // 失败优先处理
      if (state.error) {
        setLoading(false);
        setErrored(true);
        toast.error("预览加载失败");
        setOpen(false);
        return;
      }
      if (state.ready) {
        renderedRef.current = true;
        setLoading(false);
        setErrored(false);
      } else if (state.loading && !renderedRef.current) {
        setLoading(true);
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
          renderedRef.current = false;
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

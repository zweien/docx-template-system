"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WelcomeDialogProps {
  open: boolean;
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeDialog({ open, onStart, onSkip }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onSkip()} disablePointerDismissal>
      <DialogContent
        className="sm:max-w-[420px] text-center"
        showCloseButton={false}
      >
        <DialogHeader className="items-center">
          <div className="text-4xl mb-2">👋</div>
          <DialogTitle className="text-lg">
            欢迎使用 IDRL 填表系统
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            这是一个模板驱动的文档生成平台。
            <br />
            只需 2 分钟，带你快速了解核心功能。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={onStart}>开始引导（约 2 分钟）</Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={onSkip}>
            跳过，稍后再看
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

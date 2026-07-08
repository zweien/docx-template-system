"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileArchive, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * 「上传模板」入口弹窗：选择创建填表生成型还是文件下载型模板。
 */
export function CreateTemplateDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const goTo = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Upload className="h-4 w-4" />
            上传模板
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>选择模板类型</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => goTo("/templates/new")}
            className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <Upload className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 font-medium">
                填表生成型
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                上传带占位符的 docx，团队在线填写表单后生成文档
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => goTo("/templates/new-download")}
            className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted"
          >
            <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <FileArchive className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 font-medium">
                文件下载型
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                上传一套文件（复杂表格、材料包等），打包供团队直接下载
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

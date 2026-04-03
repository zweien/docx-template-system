"use client";

import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CollectionAttachmentsUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">参考附件</p>
          <p className="text-xs text-muted-foreground">创建任务时会一并上传，供提交人查看和下载。</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
          选择文件
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => onChange(Array.from(event.target.files ?? []))}
      />

      {files.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>{file.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

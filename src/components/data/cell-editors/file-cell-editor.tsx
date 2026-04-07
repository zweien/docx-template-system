"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FileCellEditorProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function FileCellEditor({ initialValue, onCommit, onCancel }: FileCellEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("上传失败");

      const data = await res.json();
      setDraft(data.url);
      onCommit(data.url);
      toast.success("文件上传成功");
    } catch (err) {
      console.error(err);
      toast.error("文件上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const getFileName = (path: string) => {
    if (!path) return "";
    return path.split("/").pop() || path;
  };

  return (
    <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
      <Popover open={true} onOpenChange={(open) => !open && onCancel()}>
        <PopoverTrigger render={
          <div className="flex items-center gap-1 w-full cursor-pointer border rounded-md px-2 py-1 h-8 bg-background border-primary">
            <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-xs truncate flex-1">
              {draft ? getFileName(draft) : "点击上传..."}
            </span>
          </div>
        } />
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-medium leading-none">附件上传</h4>
              <p className="text-xs text-muted-foreground">
                输入文件路径或直接上传新文件
              </p>
            </div>
            
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="文件路径..."
                className="h-8 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); onCommit(draft); }
                  if (e.key === "Escape") { e.preventDefault(); onCancel(); }
                }}
              />
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 px-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleUpload}
              />
            </div>

            {draft && (
               <div className="flex items-center gap-2 p-2 bg-muted rounded-md overflow-hidden">
                 <FileIcon className="h-4 w-4 text-primary shrink-0" />
                 <span className="text-xs truncate flex-1 font-mono">
                   {getFileName(draft)}
                 </span>
                 <Button 
                   size="icon" 
                   variant="ghost" 
                   className="h-5 w-5" 
                   onClick={() => setDraft("")}
                 >
                   <X className="h-3 w-3" />
                 </Button>
               </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancel}>
                取消
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={() => onCommit(draft)}>
                确定
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (f: File) => {
      if (!f.name.endsWith(".docx")) {
        toast.error("仅支持 .docx 格式文件");
        return;
      }
      setFile(f);
      if (!name) setName(f.name.replace(/\.docx$/, ""));
    },
    [name]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) processFile(f);
    },
    [processFile]
  );

  const handleRemoveFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("请输入模板名称");
      return;
    }
    if (!file) {
      toast.error("请上传 .docx 文件");
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("模板上传成功");
        router.push(`/templates/${data.data.id}/configure`);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "上传失败");
      }
    } catch {
      toast.error("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>上传模板</CardTitle>
        <CardDescription>
          上传 .docx 模板文件并设置基本信息，上传后可配置占位符
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drag-and-drop zone */}
        <div className="space-y-2">
          <Label>模板文件</Label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
          >
            {file ? (
              <div className="flex items-center gap-3 text-center">
                <FileText className="h-8 w-8 text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  className="ml-2 rounded-full p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    拖拽 .docx 文件到此处，或点击选择
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    仅支持 .docx 格式
                  </p>
                </div>
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Template name */}
        <div className="space-y-2">
          <Label htmlFor="template-name">
            模板名称 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入模板名称"
          />
        </div>

        {/* Template description */}
        <div className="space-y-2">
          <Label htmlFor="template-description">模板描述</Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入模板描述（可选）"
            rows={3}
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/templates")}
          disabled={uploading}
        >
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={uploading}>
          {uploading ? "上传中..." : "上传并配置"}
        </Button>
      </CardFooter>
    </Card>
  );
}

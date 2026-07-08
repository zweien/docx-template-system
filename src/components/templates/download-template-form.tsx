"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileArchive, X } from "lucide-react";
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
import { CategorySelect } from "./category-select";
import { TagMultiSelect } from "./tag-multi-select";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadTemplateForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      if (arr.length === 0) return;
      setFiles((prev) => {
        // 按文件名+大小去重
        const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
        const merged = [...prev];
        for (const f of arr) {
          const key = `${f.name}:${f.size}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(f);
          }
        }
        return merged;
      });
      if (!name && arr[0]) {
        setName(arr[0].name.replace(/\.[^.]+$/, ""));
      }
    },
    [name]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = "";
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
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("请输入模板名称");
      return;
    }
    if (files.length === 0) {
      toast.error("请至少上传一个文件");
      return;
    }

    setSubmitting(true);
    try {
      // 1. 创建 DOWNLOAD 型模板（仅元数据）
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      formData.append("deliveryMode", "DOWNLOAD");
      if (categoryId) formData.append("categoryId", categoryId);
      if (tagIds.length > 0) formData.append("tagIds", tagIds.join(","));

      const createRes = await fetch("/api/templates", {
        method: "POST",
        body: formData,
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => null);
        toast.error(err?.error?.message || "创建模板失败");
        return;
      }

      const created = await createRes.json();
      const templateId: string = created.data.id;

      // 2. 逐个上传文件到 sources/（每个都会触发后端重新打包）
      for (const file of files) {
        const fileFormData = new FormData();
        fileFormData.append("file", file);
        const upRes = await fetch(`/api/templates/${templateId}/files`, {
          method: "POST",
          body: fileFormData,
        });
        if (!upRes.ok) {
          const err = await upRes.json().catch(() => null);
          toast.error(`上传 ${file.name} 失败：${err?.error?.message || "未知错误"}`);
          // 仍跳到详情页，用户可继续补充
          break;
        }
      }

      toast.success("文件下载型模板创建成功");
      router.push(`/templates/${templateId}`);
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>上传文件下载型模板</CardTitle>
        <CardDescription>
          上传一套文件（复杂表格、材料包等），系统自动打包成 zip 供团队下载
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 多文件拖拽区 */}
        <div className="space-y-2">
          <Label>文件 <span className="text-destructive">*</span></Label>
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
            <FileArchive className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                拖拽文件到此处，或点击选择（可多选）
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                支持 docx / xlsx / pdf / zip 等任意格式
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(f.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="rounded-full p-1 hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 名称 */}
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

        {/* 描述 */}
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

        {/* 分类 */}
        <div className="space-y-2">
          <Label>分类</Label>
          <CategorySelect value={categoryId} onChange={setCategoryId} />
        </div>

        {/* 标签 */}
        <div className="space-y-2">
          <Label>标签</Label>
          <TagMultiSelect value={tagIds} onChange={setTagIds} />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/templates")}
          disabled={submitting}
        >
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "创建中..." : "创建模板"}
        </Button>
      </CardFooter>
    </Card>
  );
}

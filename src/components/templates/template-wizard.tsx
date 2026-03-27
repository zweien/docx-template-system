"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaceholderConfigTable, type PlaceholderConfigTableHandle } from "./placeholder-config-table";
import { CategorySelect } from "./category-select";
import { TagMultiSelect } from "./tag-multi-select";

// ── Types ──

interface TemplateWizardProps {
  templateId?: string;
}

interface TemplateInfo {
  id: string;
  name: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  description: string | null;
  status: string;
  dataTableId: string | null;
  dataTable?: { id: string; name: string } | null;
  placeholderCount: number;
  currentVersion?: { id: string; version: number; publishedAt: string } | null;
  nextVersion: number;
  categoryId?: string | null;
  tags?: { id: string; name: string }[];
}

const STEPS = [
  { label: "上传文件", icon: Upload },
  { label: "配置占位符", icon: FileText },
  { label: "确认发布", icon: Check },
] as const;

// ── Component ──

export function TemplateWizard({ templateId }: TemplateWizardProps) {
  const isEditMode = !!templateId;
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [workingTemplateId, setWorkingTemplateId] = useState<string | null>(
    templateId ?? null
  );

  // Step 1 state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(isEditMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const configTableRef = useRef<PlaceholderConfigTableHandle>(null);

  // Drag & drop state
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 3 state
  const [templateInfo, setTemplateInfo] = useState<TemplateInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ── Fetch template info in edit mode ──

  const fetchTemplateInfo = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/templates/${id}`);
        if (!res.ok) {
          toast.error("获取模板信息失败");
          return null;
        }
        const data = await res.json();
        return data.data as TemplateInfo & { placeholders?: unknown[] };
      } catch {
        toast.error("获取模板信息失败");
        return null;
      }
    },
    []
  );

  useEffect(() => {
    if (!isEditMode || !templateId) return;

    const load = async () => {
      setLoadingTemplate(true);
      const data = await fetchTemplateInfo(templateId);
      if (data) {
        setName(data.name);
        setDescription(data.description ?? "");
        setCategoryId(data.categoryId ?? null);
        setTagIds(data.tags?.map((t: { id: string; name: string }) => t.id) ?? []);
        setCurrentFileName(data.originalFileName || data.fileName);
      }
      setLoadingTemplate(false);
    };

    load();
  }, [isEditMode, templateId, fetchTemplateInfo]);

  // ── Step 3: Fetch summary info ──

  const loadSummaryInfo = useCallback(async () => {
    if (!workingTemplateId) return;
    setLoadingInfo(true);

    try {
      const [templateRes, versionsRes] = await Promise.all([
        fetch(`/api/templates/${workingTemplateId}`),
        fetch(`/api/templates/${workingTemplateId}/versions`),
      ]);

      if (!templateRes.ok) {
        toast.error("获取模板信息失败");
        setLoadingInfo(false);
        return;
      }

      const templateData = await templateRes.json();
      const template = templateData.data;

      let nextVersion = 1;
      if (versionsRes.ok) {
        const versionsData = await versionsRes.json();
        const versions = versionsData.data as Array<{ version: number }>;
        if (versions && versions.length > 0) {
          nextVersion =
            Math.max(...versions.map((v) => v.version)) + 1;
        }
      }

      setTemplateInfo({
        id: template.id,
        name: template.name,
        fileName: template.fileName,
        originalFileName: template.originalFileName,
        fileSize: template.fileSize,
        description: template.description,
        status: template.status,
        dataTableId: template.dataTableId,
        dataTable: template.dataTable,
        placeholderCount: template.placeholders?.length ?? 0,
        currentVersion: template.currentVersion ?? null,
        nextVersion,
      });
    } catch {
      toast.error("获取模板信息失败");
    } finally {
      setLoadingInfo(false);
    }
  }, [workingTemplateId]);

  // ── Handlers ──

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith(".docx")) {
        toast.error("仅支持 .docx 格式文件");
        return;
      }
      setFile(selected);
      setCurrentFileName(selected.name);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      if (!dropped.name.endsWith(".docx")) {
        toast.error("仅支持 .docx 格式文件");
        return;
      }
      setFile(dropped);
      setCurrentFileName(dropped.name);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleStep1Submit = async () => {
    if (!name.trim()) {
      toast.error("请输入模板名称");
      return;
    }

    if (!categoryId) {
      toast.error("请选择分类");
      return;
    }

    if (!isEditMode && !file) {
      toast.error("请上传 .docx 文件");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode && workingTemplateId) {
        // Edit mode: update template
        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);

        // Check if PUT supports FormData or JSON
        // Current PUT expects JSON, so we use JSON for name/description
        // File replacement would need a separate endpoint or FormData support
        const res = await fetch(`/api/templates/${workingTemplateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, categoryId, tagIds }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          toast.error(data?.error?.message || "更新模板失败");
          return;
        }

        // Auto-parse placeholders only when a new file was uploaded
        if (file) {
          const parseRes = await fetch(
            `/api/templates/${workingTemplateId}/placeholders`,
            { method: "POST" }
          );
          if (parseRes.ok) {
            toast.success("占位符已重新解析");
          }
        }

        toast.success("模板信息已更新");
      } else {
        // Create mode: upload new template
        if (!file) {
          toast.error("请上传 .docx 文件");
          return;
        }

        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);
        formData.append("categoryId", categoryId || "");
        formData.append("tagIds", tagIds.join(","));
        formData.append("file", file);

        const res = await fetch("/api/templates", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          toast.error(data?.error?.message || "创建模板失败");
          return;
        }

        const result = await res.json();
        const newId = result.data.id;
        setWorkingTemplateId(newId);

        // Auto-parse placeholders
        const parseRes = await fetch(`/api/templates/${newId}/placeholders`, {
          method: "POST",
        });
        if (parseRes.ok) {
          toast.success("占位符已自动解析");
        }

        toast.success("模板创建成功");
      }

      setCurrentStep(2);
    } catch {
      toast.error("操作失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      handleStep1Submit();
    } else if (currentStep === 2) {
      // Save placeholder changes before proceeding
      if (configTableRef.current) {
        const saved = await configTableRef.current.save();
        if (!saved) return; // save failed, stay on step 2
      }
      loadSummaryInfo();
      setCurrentStep(3);
    }
  };

  const handlePrev = () => {
    if (currentStep === 2) setCurrentStep(1);
    else if (currentStep === 3) setCurrentStep(2);
  };

  const handlePublish = async () => {
    if (!workingTemplateId) return;

    setPublishing(true);
    try {
      const res = await fetch(
        `/api/templates/${workingTemplateId}/publish`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "发布失败");
        return;
      }

      toast.success("版本发布成功");
      router.push(`/templates/${workingTemplateId}`);
    } catch {
      toast.error("发布失败，请重试");
    } finally {
      setPublishing(false);
    }
  };

  // ── Render ──

  const cancelHref = isEditMode
    ? `/templates/${templateId}`
    : "/templates";

  if (loadingTemplate) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  return (
    <div className={`mx-auto space-y-6 ${currentStep === 2 ? 'max-w-6xl' : 'max-w-3xl'}`}>
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, index) => {
          const stepNum = (index + 1) as 1 | 2 | 3;
          const isActive = currentStep === stepNum;
          const isCompleted = currentStep > stepNum;
          const Icon = step.icon;

          return (
            <React.Fragment key={stepNum}>
              {index > 0 && (
                <div
                  className={`h-px w-12 ${
                    currentStep > stepNum
                      ? "bg-primary"
                      : "bg-border"
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCompleted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-xs ${
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {isEditMode ? "编辑模板信息" : "上传文件并填写基本信息"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isEditMode
                    ? "修改模板名称、描述或替换文件"
                    : "选择 .docx 模板文件并填写模板名称"}
                </p>
              </div>

              {/* File Upload Area */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  模板文件 {isEditMode ? "(可选，留空则不替换)" : ""}
                </label>
                <div
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : file
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {file ? (
                    <>
                      <FileText className="mb-2 h-8 w-8 text-primary" />
                      <p className="text-sm font-medium">{currentFileName}</p>
                      <p className="text-xs text-muted-foreground">
                        点击或拖拽替换文件
                      </p>
                    </>
                  ) : isEditMode && currentFileName ? (
                    <>
                      <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm font-medium">{currentFileName}</p>
                      <p className="text-xs text-muted-foreground">
                        点击或拖拽替换文件
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        拖拽 .docx 文件到此处，或点击选择
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  模板名称 <span className="text-destructive">*</span>
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：劳动合同模板"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">描述（可选）</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述模板用途"
                  rows={3}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  分类 <span className="text-destructive">*</span>
                </label>
                <CategorySelect value={categoryId} onChange={setCategoryId} />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-sm font-medium">标签（可选）</label>
                <TagMultiSelect value={tagIds} onChange={setTagIds} />
              </div>
            </div>
          )}

          {currentStep === 2 && workingTemplateId && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">配置占位符</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  调整占位符的标签、输入类型、默认值等配置
                </p>
              </div>
              <PlaceholderConfigTable
                ref={configTableRef}
                templateId={workingTemplateId}
                hideActions
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">确认并发布</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  检查模板信息，确认无误后发布版本
                </p>
              </div>

              {loadingInfo ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    加载信息中...
                  </span>
                </div>
              ) : templateInfo ? (
                <div className="space-y-4">
                  <div className="rounded-lg border">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="px-4 py-3 font-medium text-muted-foreground w-32">
                            模板名称
                          </td>
                          <td className="px-4 py-3">{templateInfo.name}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 font-medium text-muted-foreground">
                            文件名
                          </td>
                          <td className="px-4 py-3">
                            {templateInfo.originalFileName}
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 font-medium text-muted-foreground">
                            占位符数量
                          </td>
                          <td className="px-4 py-3">
                            {templateInfo.placeholderCount} 个
                          </td>
                        </tr>
                        {templateInfo.dataTable && (
                          <tr className="border-b">
                            <td className="px-4 py-3 font-medium text-muted-foreground">
                              关联数据表
                            </td>
                            <td className="px-4 py-3">
                              {templateInfo.dataTable.name}
                            </td>
                          </tr>
                        )}
                        {templateInfo.currentVersion && (
                          <tr className="border-b">
                            <td className="px-4 py-3 font-medium text-muted-foreground">
                              当前版本
                            </td>
                            <td className="px-4 py-3">
                              v{templateInfo.currentVersion.version}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm text-primary">
                      发布后将创建版本 v{templateInfo.nextVersion}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  无法加载模板信息
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          render={<Link href={cancelHref} />}
        >
          取消
        </Button>

        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrev}>
              <ArrowLeft className="h-4 w-4" />
              上一步
            </Button>
          )}

          {currentStep < 3 ? (
            <Button onClick={handleNext} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              下一步
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={publishing || !templateInfo}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              发布版本 v{templateInfo?.nextVersion ?? 1}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

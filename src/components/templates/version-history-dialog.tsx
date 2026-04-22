"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import type { TemplateVersionListItem, TemplateVersionDetail } from "@/types/template";
import type { PlaceholderSnapshotItem } from "@/types/placeholder";
import { getPlaceholderInputTypeLabel } from "@/lib/placeholder-input-type";

interface VersionHistoryDialogProps {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDialog({ templateId, open, onOpenChange }: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<TemplateVersionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [versionDetail, setVersionDetail] = useState<TemplateVersionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch version list when dialog opens
  const fetchVersions = useCallback(async () => {
    if (!open || !templateId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/versions`);
      if (!res.ok) {
        throw new Error("获取版本历史失败");
      }
      const json = await res.json();
      setVersions(json.data);
    } catch (error) {
      console.error("获取版本历史失败:", error);
    } finally {
      setLoading(false);
    }
  }, [open, templateId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setExpandedVersion(null);
      setVersionDetail(null);
      setVersions([]);
    }
  }, [open]);

  // Fetch version detail when a version is expanded
  const handleVersionClick = async (version: number) => {
    if (expandedVersion === version) {
      // Collapse
      setExpandedVersion(null);
      setVersionDetail(null);
      return;
    }

    // Expand and fetch detail
    setExpandedVersion(version);
    setLoadingDetail(true);
    setVersionDetail(null);

    try {
      const res = await fetch(`/api/templates/${templateId}/versions/${version}`);
      if (!res.ok) {
        throw new Error("获取版本详情失败");
      }
      const json = await res.json();
      setVersionDetail(json.data);
    } catch (error) {
      console.error("获取版本详情失败:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  const formatFileSize = (bytes: number) => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>版本历史</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">加载中...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">暂无版本历史</p>
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.version} className="border rounded-lg">
                {/* Version row - clickable */}
                <button
                  type="button"
                  onClick={() => handleVersionClick(v.version)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  {expandedVersion === v.version ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <Badge variant="secondary" className="shrink-0">
                    v{v.version}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(v.publishedAt)}
                  </span>
                  <span className="text-sm">by {v.publishedByName}</span>
                  <span className="text-sm text-muted-foreground ml-auto">
                    {v.placeholderCount} 个占位符
                  </span>
                </button>

                {/* Expanded detail */}
                {expandedVersion === v.version && (
                  <div className="border-t p-4 space-y-4">
                    {loadingDetail ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">加载详情...</span>
                      </div>
                    ) : versionDetail ? (
                      <>
                        {/* File info */}
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><span className="font-medium text-foreground">文件名:</span> {versionDetail.originalFileName}</p>
                          <p><span className="font-medium text-foreground">文件大小:</span> {formatFileSize(versionDetail.fileSize)}</p>
                        </div>

                        {/* Linked data table */}
                        {versionDetail.dataTable && (
                          <div className="text-sm">
                            <span className="font-medium">关联数据表:</span>{" "}
                            <Badge variant="outline">{versionDetail.dataTable.name}</Badge>
                          </div>
                        )}

                        {/* Placeholder snapshot */}
                        <div>
                          <h4 className="text-sm font-medium mb-2">占位符配置快照</h4>
                          {versionDetail.placeholderSnapshot.length > 0 ? (
                            <div className="border rounded-md">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[120px]">键名</TableHead>
                                    <TableHead>标签</TableHead>
                                    <TableHead className="w-[100px]">输入类型</TableHead>
                                    <TableHead className="w-[60px]">必填</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {versionDetail.placeholderSnapshot.map((ph: PlaceholderSnapshotItem) => (
                                    <TableRow key={ph.key}>
                                      <TableCell className="font-mono text-xs text-muted-foreground">
                                        {ph.key}
                                      </TableCell>
                                      <TableCell>{ph.label}</TableCell>
                                      <TableCell>{getPlaceholderInputTypeLabel(ph.inputType)}</TableCell>
                                      <TableCell>{ph.required ? "是" : "否"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">无占位符</p>
                          )}
                        </div>

                        {/* Field mapping info */}
                        {versionDetail.fieldMapping && Object.keys(versionDetail.fieldMapping).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">字段映射</h4>
                            <div className="text-sm text-muted-foreground">
                              {Object.entries(versionDetail.fieldMapping).map(([key, value]) => (
                                <span key={key} className="inline-block mr-3">
                                  <span className="font-mono text-xs">{key}</span>
                                  {" → "}
                                  <span>{value || "(未映射)"}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

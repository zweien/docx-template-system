"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Download,
  FileText,
  ExternalLink,
  X,
} from "lucide-react";
import type { BatchGenerationResult } from "@/types/batch-generation";

interface Step4ResultProps {
  result: BatchGenerationResult | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export function Step4Result({
  result,
  isLoading,
  error,
  onClose,
}: Step4ResultProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">正在生成文档...</h2>
          <p className="text-zinc-500 text-sm mt-1">
            请稍候，正在处理您的请求
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-zinc-500">生成中，请勿关闭页面...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium text-red-600">生成失败</h2>
          <p className="text-zinc-500 text-sm mt-1">
            文档生成过程中发生错误
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
        <div className="flex justify-end pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 text-zinc-500">
          无生成结果
        </div>
        <div className="flex justify-end pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    );
  }

  const successCount = result.generatedRecords?.length ?? 0;
  const failedCount = result.errors?.length ?? 0;
  const totalCount = successCount + failedCount;

  const handleDownload = () => {
    if (result.downloadUrl) {
      window.open(result.downloadUrl, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">
            {result.success ? "生成完成" : "生成完成（部分失败）"}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            文档批量生成已完成
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-zinc-600">{totalCount}</div>
          <div className="text-sm text-zinc-500">总记录数</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-2xl font-bold text-green-600">{successCount}</span>
          </div>
          <div className="text-sm text-green-600">成功</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="text-2xl font-bold text-red-600">{failedCount}</span>
          </div>
          <div className="text-sm text-red-600">失败</div>
        </div>
      </div>

      {/* 下载按钮 */}
      {result.downloadUrl && (
        <div className="flex justify-center">
          <Button onClick={handleDownload} size="lg">
            <Download className="h-4 w-4 mr-2" />
            下载 ZIP 压缩包
          </Button>
        </div>
      )}

      {/* 生成文件列表 */}
      {result.generatedRecords && result.generatedRecords.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">生成的文件</h3>
          <div className="border rounded-lg divide-y max-h-60 overflow-auto">
            {result.generatedRecords.map((record, index) => (
              <div
                key={record.id || index}
                className="flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm">{record.fileName}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  成功
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错误列表 */}
      {result.errors && result.errors.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-red-600">失败记录</h3>
          <div className="border border-red-200 rounded-lg divide-y divide-red-100 max-h-60 overflow-auto">
            {result.errors.map((err, index) => (
              <div
                key={err.recordId || index}
                className="flex items-start gap-3 p-3"
              >
                <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">记录 ID: {err.recordId}</div>
                  <div className="text-sm text-red-500">{err.error}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部操作 */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
        {result.batchId && (
          <Button variant="outline" onClick={() => {
            window.location.href = `/batch/${result.batchId}`;
          }}>
            查看详情
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

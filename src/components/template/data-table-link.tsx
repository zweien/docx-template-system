"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Unlink, Settings2 } from "lucide-react";
import { FieldMappingDialog } from "./field-mapping-dialog";
import type { TemplateFieldMapping } from "@/types/template";
import type { DataTableListItem, DataFieldItem } from "@/types/data-table";

interface DataTableLinkProps {
  templateId: string;
  dataTableId: string | null;
  dataTable: { id: string; name: string } | null;
  fieldMapping: TemplateFieldMapping | null;
  placeholders: Array<{ key: string; label: string; required: boolean }>;
  onUpdate: () => void;
}

export function DataTableLink({
  templateId,
  dataTableId,
  dataTable,
  fieldMapping,
  placeholders,
  onUpdate,
}: DataTableLinkProps) {
  const router = useRouter();
  const [tables, setTables] = useState<DataTableListItem[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(dataTableId);
  const [fields, setFields] = useState<DataFieldItem[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);

  // 加载数据表列表
  useEffect(() => {
    const fetchTables = async () => {
      setTablesLoading(true);
      try {
        const response = await fetch("/api/data-tables");
        const result = await response.json();
        if (response.ok) {
          setTables(result);
        }
      } catch (error) {
        console.error("获取数据表列表失败:", error);
      } finally {
        setTablesLoading(false);
      }
    };
    fetchTables();
  }, []);

  // 当选择的数据表变化时，加载字段
  useEffect(() => {
    if (!selectedTableId) {
      setFields([]);
      return;
    }

    const fetchFields = async () => {
      setFieldsLoading(true);
      try {
        const response = await fetch(`/api/data-tables/${selectedTableId}/fields`);
        const result = await response.json();
        if (response.ok) {
          setFields(result);
        }
      } catch (error) {
        console.error("获取字段失败:", error);
      } finally {
        setFieldsLoading(false);
      }
    };
    fetchFields();
  }, [selectedTableId]);

  // 计算已配置的映射数量
  const configuredCount = fieldMapping
    ? Object.values(fieldMapping).filter((v) => v !== null).length
    : 0;
  const totalPlaceholders = placeholders.length;

  const handleTableChange = async (tableId: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataTableId: tableId }),
      });

      if (response.ok) {
        setSelectedTableId(tableId);
        onUpdate();
        router.refresh();
      }
    } catch (error) {
      console.error("更新关联失败:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("确定要取消关联吗？")) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataTableId: null, fieldMapping: null }),
      });

      if (response.ok) {
        setSelectedTableId(null);
        setFields([]);
        onUpdate();
        router.refresh();
      }
    } catch (error) {
      console.error("取消关联失败:", error);
    } finally {
      setSaving(false);
    }
  };

  // 边界情况：模板没有占位符
  if (placeholders.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        模板没有占位符，无需配置字段映射
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 数据表选择 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium shrink-0">关联数据表：</span>
        {selectedTableId && dataTable ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{dataTable.name}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnlink}
              disabled={saving}
            >
              <Unlink className="h-4 w-4" />
              取消关联
            </Button>
          </div>
        ) : (
          <Select
            value={selectedTableId || ""}
            onValueChange={(v) => v && handleTableChange(v)}
            disabled={tablesLoading || saving}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="请选择数据表">
                {selectedTableId
                  ? (() => {
                      const selectedTable = tables.find((t) => t.id === selectedTableId);
                      return selectedTable
                        ? `${selectedTable.name} (${selectedTable.recordCount} 条记录)`
                        : "请选择数据表";
                    })()
                  : "请选择数据表"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tablesLoading ? (
                <SelectItem value="_loading" disabled>
                  加载中...
                </SelectItem>
              ) : tables.length === 0 ? (
                <SelectItem value="_empty" disabled>
                  暂无数据表
                </SelectItem>
              ) : (
                tables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name} ({table.recordCount} 条记录)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 字段映射状态和配置 */}
      {selectedTableId && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            字段映射：
            {fieldsLoading ? (
              <Loader2 className="h-3 w-3 animate-spin inline ml-1" />
            ) : fields.length === 0 ? (
              <span className="text-amber-600 ml-1">数据表没有字段，请先添加字段</span>
            ) : (
              <Badge variant="outline" className="ml-2">
                {configuredCount}/{totalPlaceholders} 已配置
              </Badge>
            )}
          </span>
          {fields.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMappingDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              配置字段映射
            </Button>
          )}
        </div>
      )}

      {/* 字段映射弹窗 */}
      {selectedTableId && fields.length > 0 && (
        <FieldMappingDialog
          open={mappingDialogOpen}
          onOpenChange={setMappingDialogOpen}
          templateId={templateId}
          placeholders={placeholders}
          fields={fields}
          currentMapping={fieldMapping}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

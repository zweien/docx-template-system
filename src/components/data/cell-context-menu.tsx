"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { MessageSquare } from "lucide-react"
import type { CellContext } from "@/hooks/use-cell-context"
import type { DataFieldItem, DataRecordItem } from "@/types/data-table"
import { ReactNode, useCallback } from "react"

interface CellContextMenuProps {
  context: CellContext
  fields: DataFieldItem[]
  records: DataRecordItem[]
  isAdmin?: boolean
  groupBy?: string | null
  onEditCell?: (recordId: string, fieldKey: string) => void
  onEditField?: (fieldKey: string) => void
  onDeleteField?: (fieldKey: string) => void
  onCopyCellValue?: (recordId: string, fieldKey: string) => void
  onPasteCellValue?: (recordId: string, fieldKey: string) => void
  onClearCell?: (recordId: string, fieldKey: string) => void
  onFillDown?: (recordId: string, fieldKey: string, rowIndex: number) => void
  onInsertRow?: (referenceRecordId: string, position: "above" | "below") => void
  onDeleteRecord?: (recordId: string) => void
  onDuplicateRecord?: (recordId: string) => void
  onFilterByCell?: (fieldKey: string, value: string) => void
  onSortColumn?: (fieldKey: string, order: "asc" | "desc") => void
  onGroupByField?: (fieldKey: string | null) => void
  onToggleFreeze?: (colIndex: number, frozenCount: number) => void
  frozenCount?: number
  onHideColumn?: (fieldKey: string) => void
  onAutoFitColumn?: (fieldKey: string) => void
  onOpenDetail?: (recordId: string) => void
  onAddConditionalFormat?: (fieldKey: string, value: string) => void
  onSelectRow?: (recordId: string) => void
  onSelectColumn?: (fieldKey: string) => void
  onSelectAll?: () => void
  onAddCellComment?: (recordId: string, fieldKey: string) => void
  children: ReactNode
}

export function CellContextMenu({
  context,
  fields,
  records,
  isAdmin,
  groupBy,
  onEditCell,
  onEditField,
  onDeleteField,
  onCopyCellValue,
  onPasteCellValue,
  onClearCell,
  onFillDown,
  onInsertRow,
  onDeleteRecord,
  onDuplicateRecord,
  onFilterByCell,
  onSortColumn,
  onGroupByField,
  onToggleFreeze,
  frozenCount = 0,
  onHideColumn,
  onAutoFitColumn,
  onOpenDetail,
  onAddConditionalFormat,
  onSelectRow,
  onSelectColumn,
  onSelectAll,
  onAddCellComment,
  children,
}: CellContextMenuProps) {
  const { targetType, recordId, fieldKey, colIndex, rowIndex } = context
  const frozenCountValue = frozenCount ?? 0

  const getCellValue = useCallback(() => {
    if (!recordId || !fieldKey) return ""
    const record = records.find((r) => r.id === recordId)
    return record ? String(record.data[fieldKey] ?? "") : ""
  }, [recordId, fieldKey, records])

  const renderCellMenu = () => {
    if (targetType !== "cell" || !recordId || !fieldKey) return null
    const field = fields.find((f) => f.key === fieldKey)
    return (
      <>
        {field && field.type !== "RELATION_SUBTABLE" && (
          <ContextMenuItem onClick={() => onEditCell?.(recordId, fieldKey)}>
            编辑单元格
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onAddCellComment?.(recordId, fieldKey)}>
          <MessageSquare className="h-3.5 w-3.5 mr-2" />
          添加评论
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopyCellValue?.(recordId, fieldKey)}>
          复制单元格值
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onPasteCellValue?.(recordId, fieldKey)}>
          粘贴
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onClearCell?.(recordId, fieldKey)}>
          清空单元格
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onFillDown?.(recordId, fieldKey, rowIndex ?? 0)}>
          向下填充
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "above")}>
          上方插入行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "below")}>
          下方插入行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDeleteRecord?.(recordId)}>
          删除行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onSelectRow?.(recordId)}>
          选中此行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSelectColumn?.(fieldKey)}>
          选中此列
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSelectAll?.()}>
          全选
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onFilterByCell?.(fieldKey, getCellValue())}>
          按此单元格筛选
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "asc")}>
          按此列升序排序
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "desc")}>
          按此列降序排序
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onAddConditionalFormat?.(fieldKey, getCellValue())}>
          添加条件格式...
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onOpenDetail?.(recordId)}>
          展开记录详情
        </ContextMenuItem>
      </>
    )
  }

  const renderRowHeaderMenu = () => {
    if (targetType !== "rowHeader" || !recordId) return null
    return (
      <>
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "above")}>
          上方插入行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onInsertRow?.(recordId, "below")}>
          下方插入行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicateRecord?.(recordId)}>
          复制行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onDeleteRecord?.(recordId)}>
          删除行
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onSelectRow?.(recordId)}>
          选中此行
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSelectAll?.()}>
          全选
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onOpenDetail?.(recordId)}>
          展开记录详情
        </ContextMenuItem>
      </>
    )
  }

  const renderColHeaderMenu = () => {
    if (targetType !== "colHeader" || !fieldKey || colIndex === null) return null
    return (
      <>
        <ContextMenuItem onClick={() => onEditField?.(fieldKey)}>
          修改
        </ContextMenuItem>
        {isAdmin && (
          <>
            <ContextMenuItem
              onClick={() => {
                if (confirm("确定要删除此字段吗？删除后该字段的所有数据将被清除。")) {
                  onDeleteField?.(fieldKey)
                }
              }}
              className="text-red-600"
            >
              删除字段
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "asc")}>
          升序排序
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "desc")}>
          降序排序
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onGroupByField?.(groupBy === fieldKey ? null : fieldKey)}>
          {groupBy === fieldKey ? "取消分组" : "按此字段分组"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onToggleFreeze?.(colIndex, frozenCountValue)}>
          {colIndex < frozenCountValue ? "解冻列" : "冻结到此列"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onHideColumn?.(fieldKey)}>
          隐藏列
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onAutoFitColumn?.(fieldKey)}>
          自动适配宽度
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onSelectColumn?.(fieldKey)}>
          选中此列
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onFilterByCell?.(fieldKey, "")}>
          筛选此列
        </ContextMenuItem>
      </>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex-1 min-h-0 flex flex-col outline-none">{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {renderCellMenu()}
        {renderRowHeaderMenu()}
        {renderColHeaderMenu()}
      </ContextMenuContent>
    </ContextMenu>
  )
}

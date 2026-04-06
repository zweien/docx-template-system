"use client"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { CellContext } from "@/hooks/use-cell-context"
import type { DataFieldItem, DataRecordItem } from "@/types/data-table"
import { ReactNode, useCallback } from "react"

interface CellContextMenuProps {
  context: CellContext
  fields: DataFieldItem[]
  records: DataRecordItem[]
  onEditCell?: (recordId: string, fieldKey: string) => void
  onCopyCellValue?: (recordId: string, fieldKey: string) => void
  onInsertRow?: (referenceRecordId: string, position: "above" | "below") => void
  onDeleteRecord?: (recordId: string) => void
  onDuplicateRecord?: (recordId: string) => void
  onFilterByCell?: (fieldKey: string, value: string) => void
  onSortColumn?: (fieldKey: string, order: "asc" | "desc") => void
  onToggleFreeze?: (colIndex: number, frozenCount: number) => void
  frozenCount?: number
  onHideColumn?: (fieldKey: string) => void
  onAutoFitColumn?: (fieldKey: string) => void
  onOpenDetail?: (recordId: string) => void
  onAddConditionalFormat?: (fieldKey: string, value: string) => void
  children: ReactNode
}

export function CellContextMenu({
  context,
  fields,
  records,
  onEditCell,
  onCopyCellValue,
  onInsertRow,
  onDeleteRecord,
  onDuplicateRecord,
  onFilterByCell,
  onSortColumn,
  onToggleFreeze,
  frozenCount = 0,
  onHideColumn,
  onAutoFitColumn,
  onOpenDetail,
  onAddConditionalFormat,
  children,
}: CellContextMenuProps) {
  const { targetType, recordId, fieldKey, colIndex } = context
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
        <ContextMenuItem onClick={() => onCopyCellValue?.(recordId, fieldKey)}>
          复制单元格值
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
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "asc")}>
          升序排序
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortColumn?.(fieldKey, "desc")}>
          降序排序
        </ContextMenuItem>
        <ContextMenuSeparator />
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
        <ContextMenuItem onClick={() => onFilterByCell?.(fieldKey, "")}>
          筛选此列
        </ContextMenuItem>
      </>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {renderCellMenu()}
        {renderRowHeaderMenu()}
        {renderColHeaderMenu()}
      </ContextMenuContent>
    </ContextMenu>
  )
}

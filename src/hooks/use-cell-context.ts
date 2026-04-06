"use client"

import { useCallback, useState } from "react"

export type ContextTargetType = "cell" | "rowHeader" | "colHeader"

export interface CellContext {
  targetType: ContextTargetType
  recordId: string | null
  fieldKey: string | null
  rowIndex: number | null
  colIndex: number | null
}

const DEFAULT_CONTEXT: CellContext = {
  targetType: "cell",
  recordId: null,
  fieldKey: null,
  rowIndex: null,
  colIndex: null,
}

export function useCellContext() {
  const [context, setContext] = useState<CellContext>(DEFAULT_CONTEXT)

  const captureCell = useCallback(
    (e: React.MouseEvent, recordId: string, fieldKey: string, rowIndex: number, colIndex: number) => {
      e.preventDefault()
      setContext({ targetType: "cell", recordId, fieldKey, rowIndex, colIndex })
    },
    [],
  )

  const captureRowHeader = useCallback(
    (e: React.MouseEvent, recordId: string, rowIndex: number) => {
      e.preventDefault()
      setContext({ targetType: "rowHeader", recordId, fieldKey: null, rowIndex, colIndex: null })
    },
    [],
  )

  const captureColHeader = useCallback(
    (e: React.MouseEvent, fieldKey: string, colIndex: number) => {
      e.preventDefault()
      setContext({ targetType: "colHeader", recordId: null, fieldKey, rowIndex: null, colIndex })
    },
    [],
  )

  return { context, captureCell, captureRowHeader, captureColHeader }
}

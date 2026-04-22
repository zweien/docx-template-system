"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ROW_HEIGHT = 40;
const BUFFER = 5; // extra rows above/below viewport

export interface VirtualRowsResult {
  startIndex: number;
  endIndex: number;
  topPadding: number;
  bottomPadding: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export function useVirtualRows(
  totalRows: number,
  containerHeight?: number,
  rowHeight?: number
): VirtualRowsResult {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(containerHeight ?? 600);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    setViewportHeight(el.clientHeight || containerHeight || 600);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, containerHeight]);

  useEffect(() => {
    if (containerHeight) {
      setViewportHeight(containerHeight);
    }
  }, [containerHeight]);

  // Re-calc on totalRows change (e.g. data loaded)
  const { startIndex, endIndex, topPadding, bottomPadding } = useMemo(() => {
    const h = rowHeight ?? DEFAULT_ROW_HEIGHT;
    const maxVisible = Math.ceil(viewportHeight / h);

    const rawStart = Math.floor(scrollTop / h);
    const rawEnd = rawStart + maxVisible;

    const start = Math.max(0, rawStart - BUFFER);
    const end = Math.min(totalRows, rawEnd + BUFFER);

    return {
      startIndex: start,
      endIndex: end,
      topPadding: start * h,
      bottomPadding: Math.max(0, (totalRows - end) * h),
    };
  }, [scrollTop, totalRows, viewportHeight, rowHeight]);

  return { startIndex, endIndex, topPadding, bottomPadding, scrollRef };
}

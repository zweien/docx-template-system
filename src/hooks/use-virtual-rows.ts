"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ROW_HEIGHT = 40; // px, matches h-10 tailwind class
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
  containerHeight?: number
): VirtualRowsResult {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Re-calc on totalRows change (e.g. data loaded)
  const { startIndex, endIndex, topPadding, bottomPadding } = useMemo(() => {
    const viewportHeight =
      scrollRef.current?.clientHeight ?? containerHeight ?? 600;
    const maxVisible = Math.ceil(viewportHeight / ROW_HEIGHT);

    const rawStart = Math.floor(scrollTop / ROW_HEIGHT);
    const rawEnd = rawStart + maxVisible;

    const start = Math.max(0, rawStart - BUFFER);
    const end = Math.min(totalRows, rawEnd + BUFFER);

    return {
      startIndex: start,
      endIndex: end,
      topPadding: start * ROW_HEIGHT,
      bottomPadding: Math.max(0, (totalRows - end) * ROW_HEIGHT),
    };
  }, [scrollTop, totalRows, containerHeight]);

  return { startIndex, endIndex, topPadding, bottomPadding, scrollRef };
}

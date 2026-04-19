"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Lightweight IntersectionObserver hook for infinite scroll.
 * Attaches to a sentinel element at the bottom of a list.
 * Fires `callback` when the sentinel becomes visible.
 */
export function useInfiniteScroll(
  callback: () => void,
  options?: {
    threshold?: number;
    rootMargin?: string;
  }
  ): { sentinelRef: React.RefCallback<HTMLElement> } {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            callbackRef.current();
          }
        },
        {
          threshold: options?.threshold ?? 0.1,
          rootMargin: options?.rootMargin ?? "100px",
        }
      );
      observerRef.current.observe(node);
    },
    [options?.threshold, options?.rootMargin]
  );

  return { sentinelRef };
}

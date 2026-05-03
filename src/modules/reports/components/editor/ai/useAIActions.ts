"use client";

import { useState, useEffect, useCallback } from "react";
import type { EditorAIActionItem } from "@/types/editor-ai";

export function useAIActions() {
  const [actions, setActions] = useState<EditorAIActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch("/api/editor-ai/actions");
      if (res.ok) {
        const json = await res.json();
        setActions(json.data ?? []);
      }
    } catch {
      // Silently fail — actions are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const globalActions = actions.filter((a) => !a.userId);
  const userActions = actions.filter((a) => a.userId);

  return { actions, globalActions, userActions, loading, refresh: fetchActions };
}

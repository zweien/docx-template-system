"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type { DataFieldItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

export interface RelationOption {
  id: string;
  label: string;
}

const SIMPLE_FIELD_TYPES = new Set([
  "TEXT", "NUMBER", "DATE", "SELECT", "EMAIL", "PHONE", "BOOLEAN",
]);

interface UseRelationOptionsParams {
  relationTableId: string;
  displayField?: string;
  pageSize?: number;
  multiSelect?: boolean;
}

export function useRelationOptions({
  relationTableId,
  displayField,
  pageSize = 50,
  multiSelect = false,
}: UseRelationOptionsParams) {
  // ── Pagination state ──
  const [options, setOptions] = useState<RelationOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const fetchIdRef = useRef(0);

  // ── Search state ──
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  // ── Create record state ──
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [requiredFields, setRequiredFields] = useState<DataFieldItem[]>([]);

  // ── Multi-select state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<RelationOption[]>([]);

  // ── Build API URL ──
  const buildUrl = useCallback(
    (p: number) => {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (displayField && displayField !== "id") params.set("displayField", displayField);
      return `/api/data-tables/${relationTableId}/relation-options?${params}`;
    },
    [relationTableId, displayField, pageSize, debouncedSearch]
  );

  // ── Initial load & search reset ──
  useEffect(() => {
    if (!relationTableId) return;
    const fetchId = ++fetchIdRef.current;
    let cancelled = false;
    async function fetchFirst() {
      setIsLoading(true);
      setOptions([]);
      setPage(1);
      try {
        const res = await fetch(buildUrl(1));
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const newOptions = data.options ?? data;
        setOptions(Array.isArray(newOptions) ? newOptions : []);
        setHasMore(data.hasMore ?? false);
        setPage(1);
      } catch { /* ignore */ }
      if (!cancelled) setIsLoading(false);
    }
    fetchFirst();
    return () => { cancelled = true; };
  }, [buildUrl, relationTableId]);

  // ── Load more ──
  const isLoadingMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(buildUrl(nextPage));
      if (!res.ok) return;
      const data = await res.json();
      const newOptions = data.options ?? data;
      if (Array.isArray(newOptions)) {
        setOptions((prev) => [...prev, ...newOptions]);
      }
      setHasMore(data.hasMore ?? false);
      setPage(nextPage);
    } catch { /* ignore */ }
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
  }, [hasMore, page, buildUrl]);

  // ── Infinite scroll sentinel ──
  const { sentinelRef } = useInfiniteScroll(loadMore);

  // ── Fetch required fields for quick create ──
  useEffect(() => {
    if (!relationTableId) return;
    async function fetchFields() {
      try {
        const res = await fetch(`/api/data-tables/${relationTableId}/fields`);
        if (!res.ok) return;
        const fields: DataFieldItem[] = await res.json();
        setRequiredFields(
          fields.filter(
            (f) =>
              f.required &&
              SIMPLE_FIELD_TYPES.has(f.type) &&
              !f.key.startsWith("_")
          )
        );
      } catch { /* ignore */ }
    }
    fetchFields();
  }, [relationTableId]);

  // ── Create record ──
  const createRecord = useCallback(
    async (data: Record<string, unknown>): Promise<RelationOption | null> => {
      setIsCreating(true);
      try {
        const res = await fetch(`/api/data-tables/${relationTableId}/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "创建失败");
        }
        const record = await res.json();

        // Build display label
        let label = record.id;
        if (displayField && record.data?.[displayField] != null) {
          label = String(record.data[displayField]);
        } else if (requiredFields.length > 0 && record.data?.[requiredFields[0].key] != null) {
          label = String(record.data[requiredFields[0].key]);
        }
        const newOption: RelationOption = { id: record.id, label };

        setOptions((prev) => [newOption, ...prev]);

        // Auto-select
        if (multiSelect) {
          setSelectedIds((prev) => new Set(prev).add(newOption.id));
          setSelectedItems((prev) => [...prev, newOption]);
        }

        setShowCreateForm(false);
        return newOption;
      } catch (error) {
        throw error;
      } finally {
        setIsCreating(false);
      }
    },
    [relationTableId, displayField, requiredFields, multiSelect]
  );

  // ── Multi-select helpers ──
  const toggleSelect = useCallback(
    (id: string, label: string) => {
      if (!multiSelect) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setSelectedItems((prev) => {
        if (prev.some((i) => i.id === id)) return prev.filter((i) => i.id !== id);
        return [...prev, { id, label }];
      });
    },
    [multiSelect]
  );

  const removeSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedIds(new Set());
    setSelectedItems([]);
  }, []);

  return {
    options,
    isLoading,
    isLoadingMore,
    hasMore,
    search,
    setSearch,
    sentinelRef,
    selectedIds,
    toggleSelect,
    removeSelect,
    clearSelections,
    selectedItems,
    createRecord,
    isCreating,
    showCreateForm,
    setShowCreateForm,
    requiredFields,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { AggregateType, SummaryRowData } from "@/types/data-table";

interface UseSummaryRowOptions {
  tableId: string;
  filters: string | null;
  search: string;
  aggregations: Record<string, AggregateType>;
  enabled?: boolean;
}

export function useSummaryRow({
  tableId,
  filters,
  search,
  aggregations,
  enabled = true,
}: UseSummaryRowOptions) {
  const [summaryData, setSummaryData] = useState<SummaryRowData>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!enabled || Object.keys(aggregations).length === 0) {
      setSummaryData({});
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("aggregations", JSON.stringify(aggregations));
      if (filters) params.set("filterConditions", filters);
      if (search) params.set("search", search);

      const res = await fetch(`/api/data-tables/${tableId}/summary?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch {
      // Silently fail — summary is non-critical
    } finally {
      setIsLoading(false);
    }
  }, [tableId, filters, search, aggregations, enabled]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summaryData, isLoading, refetch: fetchSummary };
}

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface RelationOption {
  id: string;
  label: string;
}

interface RelationSelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  relationTableId: string;
  displayField: string;
  placeholder?: string;
  disabled?: boolean;
}

export function RelationSelect({
  value,
  onChange,
  relationTableId,
  displayField,
  placeholder = "选择关联记录",
  disabled = false,
}: RelationSelectProps) {
  const [allOptions, setAllOptions] = useState<RelationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Initial load — fetch all options (pageSize=500)
  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ pageSize: "500" });
        if (displayField && displayField !== "id") {
          params.set("displayField", displayField);
        }
        const res = await fetch(
          `/api/data-tables/${relationTableId}/relation-options?${params}`
        );
        if (res.ok) {
          const data = (await res.json()) as RelationOption[];
          setAllOptions(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    fetchOptions();
  }, [relationTableId, displayField]);

  // Search with debounce — re-query server when typing
  const [searchResults, setSearchResults] = useState<RelationOption[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!search) {
      setSearchResults(null);
      return;
    }
    const controller = new AbortController();
    const doSearch = async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({ search });
        if (displayField && displayField !== "id") {
          params.set("displayField", displayField);
        }
        const res = await fetch(
          `/api/data-tables/${relationTableId}/relation-options?${params}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = (await res.json()) as RelationOption[];
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // abort is fine
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    };
    const timer = setTimeout(doSearch, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, relationTableId, displayField]);

  // Merge: use searchResults when searching, otherwise allOptions
  const displayedOptions = useMemo(() => {
    if (search && searchResults !== null) return searchResults;
    if (search) {
      // Fallback client-side filter while server results are pending
      const lower = search.toLowerCase();
      return allOptions.filter((o) => o.label.toLowerCase().includes(lower));
    }
    return allOptions;
  }, [search, searchResults, allOptions]);

  const selectedOption = allOptions.find((o) => o.id === value);

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v || null)}
      disabled={disabled}
    >
      <SelectTrigger>
        {selectedOption ? (
          <span className="flex-1 text-left truncate">{selectedOption.label}</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <div className="p-2 border-b">
          <Input
            placeholder="搜索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-60 overflow-auto">
          {(isLoading || isSearching) ? (
            <div className="p-2 text-center text-zinc-500">加载中...</div>
          ) : displayedOptions.length === 0 ? (
            <div className="p-2 text-center text-zinc-500">
              {search ? "无匹配结果" : "暂无记录"}
            </div>
          ) : (
            displayedOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))
          )}
        </div>
      </SelectContent>
    </Select>
  );
}

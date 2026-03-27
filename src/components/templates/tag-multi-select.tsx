"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, Plus } from "lucide-react";

interface TagOption {
  id: string;
  name: string;
}

interface TagMultiSelectProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

export function TagMultiSelect({ value, onChange }: TagMultiSelectProps) {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setTags(data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const toggleTag = (tagId: string) => {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId));
    } else {
      onChange([...value, tagId]);
    }
  };

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "创建标签失败");
        return;
      }
      const data = await res.json();
      const newTag = data.data;
      setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      onChange([...value, newTag.id]);
      setNewTagName("");
      toast.success("标签已创建");
    } catch {
      toast.error("创建标签失败");
    } finally {
      setCreating(false);
    }
  };

  const selectedTags = tags.filter((t) => value.includes(t.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-start h-auto min-h-8" />
        }
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedTags.length === 0 ? (
            <span className="text-muted-foreground">选择标签</span>
          ) : (
            selectedTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 ml-1 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        {loading ? (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            加载中...
          </div>
        ) : tags.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            暂无标签，请在下方新建
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={value.includes(tag.id) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        <div className="border-t pt-2 flex gap-1">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="新建标签"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createTag();
              }
            }}
          />
          <Button
            size="icon-xs"
            variant="outline"
            onClick={createTag}
            disabled={!newTagName.trim() || creating}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

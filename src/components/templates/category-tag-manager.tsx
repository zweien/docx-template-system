"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface CategoryTagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CategoryItem {
  id: string;
  name: string;
  sortOrder: number;
  _count: { templates: number };
}

interface TagItem {
  id: string;
  name: string;
  _count: { templates: number };
}

export function CategoryTagManager({ open, onOpenChange }: CategoryTagManagerProps) {
  const [tab, setTab] = useState<string>("categories");

  // Category state
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [catName, setCatName] = useState("");
  const [catSortOrder, setCatSortOrder] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Tag state
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagName, setTagName] = useState("");
  const [loadingTags, setLoadingTags] = useState(false);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("获取分类列表失败");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data);
      }
    } catch (error) {
      toast.error("获取分类列表失败");
      console.error("获取分类列表失败:", error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("获取标签列表失败");
      const json = await res.json();
      if (json.success) {
        setTags(json.data);
      }
    } catch (error) {
      toast.error("获取标签列表失败");
      console.error("获取标签列表失败:", error);
    } finally {
      setLoadingTags(false);
    }
  }, []);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      fetchCategories();
      fetchTags();
    }
  }, [open, fetchCategories, fetchTags]);

  // Reset inputs when dialog closes
  useEffect(() => {
    if (!open) {
      setCatName("");
      setCatSortOrder("");
      setTagName("");
    }
  }, [open]);

  // Add category
  const handleAddCategory = useCallback(async () => {
    const name = catName.trim();
    if (!name) {
      toast.error("请输入分类名称");
      return;
    }

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sortOrder: parseInt(catSortOrder) || 0,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || json.error || "添加分类失败");
        return;
      }

      if (json.success) {
        setCategories((prev) => [...prev, { ...json.data, _count: { templates: 0 } }]);
        setCatName("");
        setCatSortOrder("");
        toast.success("分类添加成功");
      }
    } catch (error) {
      toast.error("添加分类失败");
      console.error("添加分类失败:", error);
    }
  }, [catName, catSortOrder]);

  // Delete category
  const handleDeleteCategory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || json.error || "删除分类失败");
        return;
      }

      if (json.success) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success("分类删除成功");
      }
    } catch (error) {
      toast.error("删除分类失败");
      console.error("删除分类失败:", error);
    }
  }, []);

  // Add tag
  const handleAddTag = useCallback(async () => {
    const name = tagName.trim();
    if (!name) {
      toast.error("请输入标签名称");
      return;
    }

    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || json.error || "添加标签失败");
        return;
      }

      if (json.success) {
        setTags((prev) => [...prev, { ...json.data, _count: { templates: 0 } }]);
        setTagName("");
        toast.success("标签添加成功");
      }
    } catch (_error) {
      toast.error("添加标签失败");
    }
  }, [tagName]);

  // Delete tag
  const handleDeleteTag = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || json.error || "删除标签失败");
        return;
      }

      if (json.success) {
        setTags((prev) => prev.filter((t) => t.id !== id));
        toast.success("标签删除成功");
      }
    } catch (error) {
      toast.error("删除标签失败");
      console.error("删除标签失败:", error);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分类与标签管理</DialogTitle>
          <DialogDescription>管理模板的分类和标签</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="categories">分类管理</TabsTrigger>
            <TabsTrigger value="tags">标签管理</TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {loadingCategories ? (
                <p className="text-sm text-muted-foreground py-4 text-center">加载中...</p>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">暂无分类</p>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
                  >
                    <span className="flex-1 text-sm truncate">
                      {cat.name}
                      <span className="text-muted-foreground ml-1">({cat._count.templates})</span>
                    </span>
                    <span className="text-xs text-muted-foreground">排序: {cat.sortOrder}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={cat._count.templates > 0}
                      title={cat._count.templates > 0 ? "该分类下有模板，无法删除" : "删除"}
                      onClick={() => handleDeleteCategory(cat.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t mt-3 pt-3 flex items-center gap-2">
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="分类名称"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory();
                }}
              />
              <Input
                type="number"
                value={catSortOrder}
                onChange={(e) => setCatSortOrder(e.target.value)}
                placeholder="排序"
                min={0}
                className="w-20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCategory();
                }}
              />
              <Button size="sm" onClick={handleAddCategory}>
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {loadingTags ? (
                <p className="text-sm text-muted-foreground py-4 text-center">加载中...</p>
              ) : tags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">暂无标签</p>
              ) : (
                tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
                  >
                    <span className="flex-1 text-sm truncate">
                      {tag.name}
                      <span className="text-muted-foreground ml-1">({tag._count.templates})</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="删除"
                      onClick={() => handleDeleteTag(tag.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t mt-3 pt-3 flex items-center gap-2">
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="标签名称"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag();
                }}
              />
              <Button size="sm" onClick={handleAddTag}>
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

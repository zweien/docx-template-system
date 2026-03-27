"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tags } from "lucide-react";
import { CategoryTagManager } from "./category-tag-manager";

export function CategoryTagManagerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Tags className="h-4 w-4" />
        分类管理
      </Button>
      <CategoryTagManager open={open} onOpenChange={setOpen} />
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteDraftButtonProps {
  draftId: string;
  draftName: string;
}

export function DeleteDraftButton({
  draftId,
  draftName,
}: DeleteDraftButtonProps) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("草稿已删除");
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "删除失败");
      }
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>
            确定要删除草稿「{draftName}」吗？此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleting}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? "删除中..." : "确认删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

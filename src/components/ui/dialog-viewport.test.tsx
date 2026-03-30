import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

describe("dialog viewport structure", () => {
  it("DialogContent 应渲染 viewport 容器", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>编辑数据</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    const content = await screen.findByRole("dialog", { name: "编辑数据" });
    const viewport = content.parentElement;

    expect(viewport).not.toBeNull();
    expect(viewport).toHaveAttribute("data-slot", "dialog-viewport");
  });

  it("AlertDialogContent 应渲染 viewport 容器", async () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    );

    const content = await screen.findByRole("alertdialog", { name: "确认删除" });
    const viewport = content.parentElement;

    expect(viewport).not.toBeNull();
    expect(viewport).toHaveAttribute("data-slot", "alert-dialog-viewport");
  });

  it("SheetContent 应渲染 viewport 容器", async () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>AI 助手</SheetTitle>
        </SheetContent>
      </Sheet>
    );

    const content = await screen.findByRole("dialog", { name: "AI 助手" });
    const viewport = content.parentElement;

    expect(viewport).not.toBeNull();
    expect(viewport).toHaveAttribute("data-slot", "sheet-viewport");
  });
});

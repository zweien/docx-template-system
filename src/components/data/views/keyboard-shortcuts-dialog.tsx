"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface ShortcutItem {
  keys: string[];
  description: string;
}

const shortcuts: ShortcutItem[] = [
  // Navigation
  { keys: ["↑", "↓", "←", "→"], description: "上下左右移动单元格" },
  { keys: ["Ctrl", "↑"], description: "跳转到第一个数据行" },
  { keys: ["Ctrl", "↓"], description: "跳转到最后一个数据行" },
  { keys: ["Ctrl", "←"], description: "跳转到行首" },
  { keys: ["Ctrl", "→"], description: "跳转到行尾" },
  { keys: ["Tab"], description: "移动到右侧单元格" },
  { keys: ["Shift", "Tab"], description: "移动到左侧单元格" },
  // Editing
  { keys: ["Enter"], description: "编辑当前单元格" },
  { keys: ["F2"], description: "编辑当前单元格" },
  { keys: ["Esc"], description: "退出编辑 / 取消选择" },
  { keys: ["Delete"], description: "清空当前单元格" },
  { keys: ["Backspace"], description: "清空当前单元格" },
  // Clipboard
  { keys: ["Ctrl", "C"], description: "复制单元格" },
  { keys: ["Ctrl", "X"], description: "剪切单元格" },
  { keys: ["Ctrl", "V"], description: "粘贴到单元格" },
  { keys: ["Ctrl", "D"], description: "复制整行" },
  // Selection
  { keys: ["Shift", "↑"], description: "向上扩大选择范围" },
  { keys: ["Shift", "↓"], description: "向下扩大选择范围" },
  // Special
  { keys: ["Ctrl", "F"], description: "打开查找替换栏" },
  { keys: ["Ctrl", "G"], description: "打开查找替换栏" },
  { keys: ["Enter"], description: "查找栏中跳转到下一个匹配" },
  { keys: ["Shift", "Enter"], description: "查找栏中跳转到上一个匹配" },
  { keys: ["Esc"], description: "关闭查找替换栏" },
  { keys: ["Ctrl", ";"], description: "填入当前日期" },
  { keys: ["Shift", "Enter"], description: "在当前行下方插入新行" },
  { keys: ["Space"], description: "展开/折叠分组行" },
  { keys: ["Ctrl", "Z"], description: "撤销" },
  { keys: ["Ctrl", "Y"], description: "重做" },
  { keys: ["Ctrl", "Shift", "Z"], description: "重做" },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        title="快捷键说明"
      >
        <Keyboard className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>键盘快捷键</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {shortcuts.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap align-middle">
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, j) => (
                          <span key={j}>
                            <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 text-xs font-semibold bg-muted border border-border rounded">
                              {k}
                            </kbd>
                            {j < s.keys.length - 1 && (
                              <span className="text-muted-foreground mx-0.5 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-muted-foreground">{s.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function UiCheckPage() {
  const [selectValue, setSelectValue] = useState("contract");
  const [report, setReport] = useState("pending");

  useEffect(() => {
    const readStyles = (selector: string) => {
      const element = document.querySelector(selector);

      if (!element) {
        return null;
      }

      const styles = window.getComputedStyle(element);

      return {
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        color: styles.color,
        text: element.textContent?.trim() ?? "",
      };
    };

    const timer = window.setTimeout(() => {
      setReport(
        JSON.stringify(
          {
            shell: readStyles("main > div"),
            select: readStyles('[data-testid="ui-check-select-content"]'),
            popover: readStyles('[data-testid="ui-check-popover-content"]'),
            dropdown: readStyles('[data-testid="ui-check-dropdown-content"]'),
          },
          null,
          2,
        ),
      );
    }, 800);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-muted/40 p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-2xl border border-input bg-card p-6 shadow-sm">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">UI Surface Check</h1>
          <p className="text-sm text-muted-foreground">
            用于验证 Select、Popover、DropdownMenu 的边框与弹层背景是否为不透明表面。
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Select</p>
            <Select
              value={selectValue}
              onValueChange={(value) => setSelectValue(value ?? "contract")}
              defaultOpen
            >
              <SelectTrigger className="w-full" data-testid="ui-check-select-trigger">
                <SelectValue placeholder="请选择类型" />
              </SelectTrigger>
              <SelectContent data-testid="ui-check-select-content">
                <SelectItem value="contract">合同</SelectItem>
                <SelectItem value="invoice">发票</SelectItem>
                <SelectItem value="report">报告</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Popover</p>
            <Popover defaultOpen>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid="ui-check-popover-trigger"
                  />
                }
              >
                打开 Popover
              </PopoverTrigger>
              <PopoverContent className="w-56" data-testid="ui-check-popover-content">
                <p className="font-medium">弹层标题</p>
                <p className="text-muted-foreground">这里应该是白底，不该透出背景文字。</p>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">DropdownMenu</p>
            <DropdownMenu defaultOpen modal={false}>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-full"
                    data-testid="ui-check-dropdown-trigger"
                  />
                }
              >
                打开菜单
              </DropdownMenuTrigger>
              <DropdownMenuContent data-testid="ui-check-dropdown-content">
                <DropdownMenuItem>编辑</DropdownMenuItem>
                <DropdownMenuItem>复制</DropdownMenuItem>
                <DropdownMenuItem>删除</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>

        <pre
          data-testid="ui-check-report"
          className="overflow-x-auto rounded-xl border border-input bg-muted/30 p-4 text-xs text-foreground"
        >
          {report}
        </pre>
      </div>
    </main>
  );
}

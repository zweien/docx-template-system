"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ViewType } from "@/types/data-table";
import {
  Columns3,
  GalleryHorizontal,
  GanttChart,
  LayoutGrid,
} from "lucide-react";

interface ViewSwitcherProps {
  currentType: ViewType;
  onTypeChange: (type: ViewType) => void;
}

const VIEW_ITEMS: Array<{
  type: ViewType;
  label: string;
  Icon: typeof Columns3;
}> = [
  {
    type: "GRID",
    label: "表格",
    Icon: Columns3,
  },
  {
    type: "KANBAN",
    label: "看板",
    Icon: LayoutGrid,
  },
  {
    type: "GALLERY",
    label: "画廊",
    Icon: GalleryHorizontal,
  },
  {
    type: "TIMELINE",
    label: "时间线",
    Icon: GanttChart,
  },
];

export function ViewSwitcher({
  currentType,
  onTypeChange,
}: ViewSwitcherProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 border rounded-md p-0.5">
        {VIEW_ITEMS.map(({ type, label, Icon }) => {
          const active = currentType === type;

          return (
            <Tooltip key={type}>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-sm"
                    variant={active ? "secondary" : "ghost"}
                    onClick={() => onTypeChange(type)}
                    aria-label={label}
                  />
                }
              >
                <Icon className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

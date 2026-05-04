"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { NavGroupDef } from "./schema";
import { isRouteActive } from "./matcher";
import { cn } from "@/lib/utils";

export const ACTIVE_ITEM_CLASS_NAME =
  "border border-border-hover bg-accent/20 text-foreground shadow-[inset_0_0_0_1px_rgb(113_112_255_/_0.34)]";

export const INACTIVE_ITEM_CLASS_NAME =
  "border border-transparent text-muted-foreground hover:border-border hover:bg-white/[0.03] hover:text-foreground";

type NavGroupProps = {
  readonly group: NavGroupDef;
  readonly collapsed: boolean;
};

export function NavGroup({ group, collapsed }: NavGroupProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(group.defaultExpanded ?? false);
  const GroupIcon = group.icon;

  // Check if any child matches current route
  const hasActiveChild = group.items.some((item) => isRouteActive(item.href, pathname));

  // Auto-expand when a child is active
  const isExpanded = expanded || hasActiveChild;

  // When collapsed, show group icon only, link to first active child or first item
  if (collapsed) {
    const targetItem = group.items.find((item) => isRouteActive(item.href, pathname)) ?? group.items[0];
    if (!targetItem) return null;

    const Icon = targetItem.icon;
    const isActive = hasActiveChild;

    return (
      <Link
        href={targetItem.href}
        title={group.label}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center rounded-md text-sm font-[510] transition-[color,background-color,border-color,transform,opacity] duration-100",
          "justify-center px-0 py-2.5",
          isActive ? ACTIVE_ITEM_CLASS_NAME : INACTIVE_ITEM_CLASS_NAME
        )}
      >
        <span className={cn("shrink-0 transition-transform duration-100", isActive && "scale-110")}>
          <Icon className="h-4 w-4" />
        </span>
      </Link>
    );
  }

  // Expanded sidebar: show group header with toggle + children
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-[510] uppercase tracking-wider text-text-dim transition-colors hover:text-foreground"
        aria-expanded={isExpanded}
      >
        <GroupIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-0.5 space-y-1.5">
          {group.items.map((item) => {
            const isActive = isRouteActive(item.href, pathname);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm font-[510] transition-[color,background-color,border-color,transform,opacity] duration-100",
                  "gap-3 px-3 py-2.5 pl-8",
                  isActive ? ACTIVE_ITEM_CLASS_NAME : INACTIVE_ITEM_CLASS_NAME
                )}
              >
                <span className={cn("shrink-0 transition-transform duration-100", isActive && "scale-110")}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

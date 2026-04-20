"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { AppLogo } from "@/components/layout/app-logo";
import { isRouteActive } from "@/components/layout/navigation/matcher";
import { NAV_ITEMS, filterNavItemsByRole, type NavItem } from "@/components/layout/navigation/schema";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ACTIVE_ITEM_CLASS_NAME =
  "border border-[rgb(255_255_255_/_0.1)] bg-[rgb(113_112_255_/_0.18)] text-[#f7f8f8] shadow-[inset_0_0_0_1px_rgb(113_112_255_/_0.34)]";

const INACTIVE_ITEM_CLASS_NAME =
  "border border-transparent text-[#8a8f98] hover:border-[rgb(255_255_255_/_0.08)] hover:bg-[rgb(255_255_255_/_0.03)] hover:text-[#f7f8f8]";

type MobileNavLinkProps = {
  readonly item: NavItem;
  readonly pathname: string;
  readonly onNavigate: () => void;
};

function MobileNavLink({ item, pathname, onNavigate }: MobileNavLinkProps) {
  const isActive = isRouteActive(item.href, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      onNavigate={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-[510] transition-[color,background-color,border-color,transform] duration-100",
        isActive ? ACTIVE_ITEM_CLASS_NAME : INACTIVE_ITEM_CLASS_NAME
      )}
    >
      <span className={cn("transition-transform duration-100", isActive && "scale-110")}>
        <Icon className="h-5 w-5" />
      </span>
      {item.label}
    </Link>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const role = session?.user?.role as Role | undefined;
  const navItems = filterNavItemsByRole(NAV_ITEMS, role);
  const mainItems = navItems.filter((item) => item.section === "main");
  const adminItems = navItems.filter((item) => item.section === "admin");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] text-[#d0d6e0] hover:bg-[rgb(255_255_255_/_0.05)] md:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">打开菜单</span>
          </Button>
        }
      />
      <SheetContent side="left" className="flex w-[280px] flex-col border-[rgb(255_255_255_/_0.08)] bg-[rgb(15_16_17_/_0.98)] p-0 text-[#f7f8f8]">
        <SheetHeader className="shrink-0 border-b border-[rgb(255_255_255_/_0.05)] px-4 py-4">
          <SheetTitle className="flex items-center gap-2">
            <AppLogo className="h-6" priority />
            <span className="text-lg font-[510] tracking-[-0.13px]">IDRL填表系统</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1.5">
            {mainItems.map((item) => (
              <MobileNavLink key={item.id} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />
            ))}
          </div>

          {adminItems.length > 0 && (
            <div className="mt-6 border-t border-[rgb(255_255_255_/_0.05)] pt-4">
              <p className="mb-2 px-3 text-xs font-[510] uppercase tracking-wider text-[#62666d]">
                管理员
              </p>
              <div className="space-y-1.5">
                {adminItems.map((item) => (
                  <MobileNavLink key={item.id} item={item} pathname={pathname} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-[rgb(255_255_255_/_0.05)] px-4 py-4">
          <p className="text-sm text-[#8a8f98]">
            {session?.user?.name
              ? `已登录: ${session.user.name}`
              : "未登录"}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

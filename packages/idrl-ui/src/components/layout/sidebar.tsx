"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  navItems: NavItem[]
}

function Sidebar({ navItems, className, ...props }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "flex w-64 flex-col bg-neutral-900 text-white",
        className
      )}
      {...props}
    >
      {/* Logo 区域 */}
      <div className="flex h-14 items-center px-4">
        <span className="text-lg font-semibold">IDRL填表系统</span>
      </div>

      {/* 导航项 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export { Sidebar }
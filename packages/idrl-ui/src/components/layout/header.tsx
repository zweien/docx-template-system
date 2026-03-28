"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

function Header({ children, className, ...props }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center border-b border-neutral-100 bg-white px-6",
        className
      )}
      {...props}
    >
      {children}
    </header>
  )
}

interface HeaderTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

function HeaderTitle({ className, ...props }: HeaderTitleProps) {
  return (
    <h1
      className={cn("text-2xl font-semibold", className)}
      {...props}
    />
  )
}

export { Header, HeaderTitle }
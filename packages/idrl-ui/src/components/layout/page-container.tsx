import * as React from "react"
import { cn } from "@/lib/utils"

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

function PageContainer({ children, className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-7xl px-6 py-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { PageContainer }
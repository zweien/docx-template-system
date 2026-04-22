import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-input bg-[rgb(255_255_255_/_0.02)] px-2.5 py-1 text-base text-foreground transition-[background-color,border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground placeholder:font-normal focus-visible:border-ring focus-visible:shadow-[0_0_0_1px_rgb(113_112_255_/_0.56),0_0_0_4px_rgb(113_112_255_/_0.2)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_rgb(239_68_68_/_0.25)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }

"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-[510] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:border-ring focus-visible:shadow-[0_0_0_1px_rgb(113_112_255_/_0.6),0_0_0_4px_rgb(113_112_255_/_0.22),0_4px_12px_rgb(0_0_0_/_0.25)] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_rgb(239_68_68_/_0.25)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[inset_0_-1px_0_rgb(0_0_0_/_0.24)] hover:bg-[#828fff]",
        outline:
          "border-border bg-[rgb(255_255_255_/_0.02)] text-secondary-foreground hover:border-[rgb(255_255_255_/_0.15)] hover:bg-[rgb(255_255_255_/_0.05)]",
        secondary:
          "border-border bg-[rgb(255_255_255_/_0.04)] text-secondary-foreground hover:bg-[rgb(255_255_255_/_0.06)] aria-expanded:bg-[rgb(255_255_255_/_0.06)]",
        ghost:
          "text-secondary-foreground hover:border-[rgb(255_255_255_/_0.1)] hover:bg-[rgb(255_255_255_/_0.04)] hover:text-foreground aria-expanded:bg-[rgb(255_255_255_/_0.04)] aria-expanded:text-foreground",
        destructive:
          "bg-[rgb(239_68_68_/_0.18)] text-[#ffc5c5] hover:bg-[rgb(239_68_68_/_0.28)] focus-visible:border-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-[510] whitespace-nowrap transition-all focus-visible:border-ring focus-visible:shadow-[0_0_0_1px_rgb(113_112_255_/_0.56),0_0_0_3px_rgb(113_112_255_/_0.2)] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-[#828fff]",
        secondary:
          "border-border bg-[rgb(255_255_255_/_0.04)] text-secondary-foreground [a]:hover:bg-[rgb(255_255_255_/_0.06)]",
        destructive:
          "bg-[rgb(239_68_68_/_0.15)] text-[#ffc5c5] focus-visible:ring-destructive/20 [a]:hover:bg-[rgb(239_68_68_/_0.25)]",
        outline:
          "border-border bg-transparent text-secondary-foreground [a]:hover:bg-muted [a]:hover:text-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control text-center text-sm font-medium transition-colors select-none focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-contrast hover:opacity-90",
        secondary: "bg-secondary-solid text-secondary-solid-contrast hover:opacity-90",
        tertiary: "text-primary hover:bg-hover",
        danger: "bg-danger-solid text-danger-solid-contrast hover:opacity-90",
        icon: "bg-raised text-fg hover:bg-hover",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-10 px-3 py-1.5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className as string | undefined)}
      {...props}
    />
  )
}

export { Button, buttonVariants }

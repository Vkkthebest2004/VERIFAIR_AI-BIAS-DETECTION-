import * as React from "react"
import { type VariantProps, cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
    {
        variants: {
            variant: {
                default: "bg-[var(--accent)] text-white shadow-sm hover:opacity-90 rounded-xl",
                destructive: "bg-[var(--status-danger)] text-white shadow-sm hover:opacity-90 rounded-xl",
                outline: "border border-[var(--border-primary)] bg-[var(--bg-card)] shadow-sm hover:bg-[var(--bg-card-hover)] rounded-xl",
                secondary: "bg-[var(--bg-secondary)] text-[var(--text-secondary)] shadow-sm hover:bg-[var(--bg-card-hover)] rounded-xl",
                ghost: "hover:bg-[var(--bg-card-hover)] rounded-xl text-[var(--text-secondary)]",
                link: "text-[var(--accent)] underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-8 rounded-lg px-3 text-xs",
                lg: "h-12 rounded-2xl px-7",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> { }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }

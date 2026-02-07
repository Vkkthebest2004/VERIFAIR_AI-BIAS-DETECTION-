
import * as React from "react"
import { cn } from "@/lib/utils"


interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "outline" | "ghost";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50",
                    "h-9 px-4 py-2 transition-all duration-200",
                    variant === "default" && "bg-indigo-600 text-white shadow hover:bg-indigo-500 glass-panel hover:bg-slate-700 active:scale-95",
                    variant === "outline" && "border border-slate-700 bg-transparent hover:bg-slate-800 text-slate-100",
                    variant === "ghost" && "hover:bg-slate-800 text-slate-100",
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }

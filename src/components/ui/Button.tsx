import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "accent"
  size?: "sm" | "md" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 rounded-lg",
          {
            "bg-surface-elevated hover:bg-surface-hover text-text border border-border":
              variant === "default",
            "hover:bg-surface-hover text-text-muted hover:text-text":
              variant === "ghost",
            "border border-border bg-transparent hover:bg-surface-hover text-text":
              variant === "outline",
            "bg-accent hover:bg-accent-hover text-white": variant === "accent",
          },
          {
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
            "h-10 w-10 p-0": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

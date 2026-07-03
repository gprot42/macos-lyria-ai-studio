import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label?: string
  showValue?: boolean
  formatValue?: (value: number) => string
}

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, label, showValue, formatValue, value, ...props }, ref) => {
  const displayValue = formatValue
    ? formatValue(value?.[0] ?? 0)
    : (value?.[0] ?? 0).toFixed(2)

  return (
    <div className="space-y-2">
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-text-muted">{label}</span>}
          {showValue && (
            <span className="font-mono text-text tabular-nums font-medium">{displayValue}</span>
          )}
        </div>
      )}
      <SliderPrimitive.Root
        ref={ref}
        value={value}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-surface-elevated">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-border bg-surface-elevated shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent hover:bg-surface-hover cursor-grab active:cursor-grabbing" />
      </SliderPrimitive.Root>
    </div>
  )
})
Slider.displayName = "Slider"

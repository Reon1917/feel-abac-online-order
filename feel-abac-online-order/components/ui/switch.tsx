import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-200 focus-visible:border-emerald-400 focus-visible:ring-emerald-200/60 focus-visible:ring-[3px] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:data-[state=unchecked]:bg-slate-600/60",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 translate-x-0 rounded-full border border-slate-200 bg-white ring-0 transition-transform shadow-sm data-[state=checked]:translate-x-[calc(100%-2px)]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

"use client";

import { Toaster as Sonner, toast } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-popover !text-popover-foreground !border !border-border/80 !rounded-lg !font-sans !text-[13px] !shadow-xl",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

export { Toaster, toast };

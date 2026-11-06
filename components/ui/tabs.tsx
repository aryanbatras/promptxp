"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "bg-secondary/60 text-muted-foreground inline-flex h-8 items-center gap-0.5 rounded-md p-0.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex h-7 items-center justify-center gap-1.5 rounded-[5px] px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] whitespace-nowrap transition-all focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("focus-visible:ring-ring outline-none focus-visible:ring-1", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };

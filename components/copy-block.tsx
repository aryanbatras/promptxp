"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function CopyBlock({
  value,
  className,
  label,
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className={cn("group relative rounded-md border border-border/70 bg-background/50", className)}>
      {label && <div className="label-mono border-b border-border/50 px-3 py-1.5 text-[9px]">{label}</div>}
      <pre className="overflow-x-auto px-3 py-2.5 pr-10 font-mono text-[11px] leading-relaxed text-foreground/80">
        {value}
      </pre>
      <button
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }
        }}
        className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Copy"
      >
        {copied ? <Check className="size-3 text-signal" /> : <Copy className="size-3" />}
      </button>
    </div>
  );
}

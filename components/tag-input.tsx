"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  suggestions?: string[];
}

export function TagInput({ value, onChange, placeholder, className, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = React.useState("");

  const commit = (raw: string) => {
    const tags = raw
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .filter((tag) => !value.includes(tag));
    if (tags.length) onChange([...value, ...tags].slice(0, 40));
    setDraft("");
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-secondary/60 py-0.5 pr-1 pl-1.5 font-mono text-[10px] tracking-wide text-foreground/80"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit(draft);
            } else if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={placeholder ?? "add a tag…"}
          className="h-6 min-w-[110px] flex-1 bg-transparent font-mono text-[11px] outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      {suggestions.filter((tag) => !value.includes(tag)).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions
            .filter((tag) => !value.includes(tag))
            .slice(0, 8)
            .map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onChange([...value, tag])}
                className="rounded-sm border border-dashed border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-signal/50 hover:text-signal"
              >
                + {tag}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

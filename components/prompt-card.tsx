"use client";

import * as React from "react";
import { Check, Copy, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyText } from "@/lib/client/api";
import type { PromptWithCuration } from "@/lib/query";
import { cn, formatRelative } from "@/lib/utils";

interface PromptCardProps {
  prompt: PromptWithCuration;
  view: "cards" | "compact" | "full";
  onOpen: (prompt: PromptWithCuration) => void;
  onToggleStar: (prompt: PromptWithCuration) => void;
  onCopied: (prompt: PromptWithCuration) => void;
}

function CopyAction({
  prompt,
  onCopied,
  className,
}: {
  prompt: PromptWithCuration;
  onCopied: (prompt: PromptWithCuration) => void;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={async (event) => {
            event.stopPropagation();
            if (await copyText(prompt.text)) {
              setCopied(true);
              onCopied(prompt);
              setTimeout(() => setCopied(false), 1400);
            }
          }}
          className={cn(
            "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            className,
          )}
          aria-label="Copy prompt"
        >
          {copied ? <Check className="size-3.5 text-signal" /> : <Copy className="size-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "copied" : "copy prompt"}</TooltipContent>
    </Tooltip>
  );
}

function StarAction({
  prompt,
  onToggleStar,
}: {
  prompt: PromptWithCuration;
  onToggleStar: (prompt: PromptWithCuration) => void;
}) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onToggleStar(prompt);
      }}
      className={cn(
        "grid size-7 place-items-center rounded-md transition-colors hover:bg-secondary",
        prompt.curation.starred
          ? "text-signal"
          : "text-muted-foreground/50 hover:text-foreground",
      )}
      aria-label={prompt.curation.starred ? "Unstar prompt" : "Star prompt"}
    >
      <Star className={cn("size-3.5", prompt.curation.starred && "fill-current")} />
    </button>
  );
}

export const PromptCard = React.memo(function PromptCard({
  prompt,
  view,
  onOpen,
  onToggleStar,
  onCopied,
}: PromptCardProps) {
  const tags = prompt.curation.tags ?? [];
  const starred = Boolean(prompt.curation.starred);

  if (view === "compact") {
    return (
      <div
        onClick={() => onOpen(prompt)}
        className={cn(
          "group flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 transition-colors hover:bg-secondary/40",
          starred && "bg-signal/[0.02]",
        )}
      >
        <span
          className={cn(
            "w-[54px] shrink-0 font-mono text-[10px] tabular-nums",
            starred ? "text-signal" : "text-muted-foreground/60",
          )}
        >
          {formatRelative(prompt.createdAt)}
        </span>
        <span className="hidden w-[132px] shrink-0 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 sm:block">
          {prompt.projectName}
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">{prompt.text.replace(/\s+/g, " ")}</p>
        {tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="muted" className="hidden lg:inline-flex">
            {tag}
          </Badge>
        ))}
        <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/50">
          {prompt.charCount.toLocaleString()}
        </span>
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <StarAction prompt={prompt} onToggleStar={onToggleStar} />
          <CopyAction prompt={prompt} onCopied={onCopied} />
        </div>
      </div>
    );
  }

  if (view === "full") {
    return (
      <article
        className={cn(
          "group relative rounded-lg border bg-card/40 transition-colors",
          starred ? "border-signal/35" : "border-border/70 hover:border-border",
        )}
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
          <button
            onClick={() => onOpen(prompt)}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/80 hover:text-signal"
          >
            {prompt.projectName}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground/30">/</span>
          <span className="max-w-[280px] truncate font-mono text-[10px] text-muted-foreground/60">
            {prompt.sessionTitle}
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">
            {formatRelative(prompt.createdAt)}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/40">
            {prompt.charCount.toLocaleString()} chars
          </span>
          <div className="flex items-center">
            <StarAction prompt={prompt} onToggleStar={onToggleStar} />
            <CopyAction prompt={prompt} onCopied={onCopied} />
          </div>
        </header>
        <div
          onClick={() => onOpen(prompt)}
          className="cursor-pointer px-4 py-4"
        >
          <pre className="font-mono text-[12px] leading-[1.65] whitespace-pre-wrap break-words text-foreground/85">
            {prompt.text}
          </pre>
        </div>
        {(tags.length > 0 || prompt.curation.note) && (
          <footer className="flex flex-wrap items-center gap-1.5 border-t border-border/60 px-4 py-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
            {prompt.curation.note && (
              <span className="font-mono text-[10px] text-muted-foreground/60">
                ✎ {prompt.curation.note.slice(0, 80)}
              </span>
            )}
          </footer>
        )}
      </article>
    );
  }

  return (
    <article
      onClick={() => onOpen(prompt)}
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-lg border bg-card/50 transition-all",
        "hover:-translate-y-px hover:bg-card hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]",
        starred ? "border-signal/35" : "border-border/70 hover:border-border",
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-3">
        <span
          className={cn(
            "truncate font-mono text-[10px] uppercase tracking-[0.14em]",
            starred ? "text-signal" : "text-foreground/70",
          )}
        >
          {prompt.projectName}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/50">
          {formatRelative(prompt.createdAt)}
        </span>
      </div>

      <p className="mt-2.5 line-clamp-[9] px-4 text-[13px] leading-[1.6] whitespace-pre-wrap text-foreground/85">
        {prompt.text}
      </p>

      <div className="mt-auto flex items-end gap-2 px-4 pt-3 pb-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <span className="font-mono text-[10px] text-muted-foreground/60">+{tags.length - 3}</span>
          )}
        </div>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/40">
          {prompt.charCount.toLocaleString()}
        </span>
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          <StarAction prompt={prompt} onToggleStar={onToggleStar} />
          <CopyAction prompt={prompt} onCopied={onCopied} />
        </div>
      </div>

      {starred && (
        <span className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-signal" aria-hidden />
      )}
    </article>
  );
});

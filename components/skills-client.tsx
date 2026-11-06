"use client";

import * as React from "react";
import { Check, Copy, FolderTree, Loader2, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, copyText } from "@/lib/client/api";
import type { Skill } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

interface SkillItem extends Skill {
  installs: number;
  installedIn: string[];
}

interface SkillsResponse {
  items: SkillItem[];
  total: number;
  scannedAt: number;
  sources: string[];
}

export function SkillsClient() {
  const [query, setQuery] = React.useState("");
  const [data, setData] = React.useState<SkillsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (source) params.set("source", source);
    setLoading(true);
    apiGet<SkillsResponse>(`/api/skills?${params.toString()}`, controller.signal)
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, source]);

  React.useEffect(() => {
    const listener = () => setQuery((value) => value);
    window.addEventListener("promptxp:rescan", listener);
    return () => window.removeEventListener("promptxp:rescan", listener);
  }, []);

  const totalInstalls = React.useMemo(
    () => (data?.items ?? []).reduce((sum, skill) => sum + skill.installs, 0),
    [data],
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="label-mono flex items-center gap-2">
        <span className="size-1 rounded-full bg-signal" />
        skills catalogue
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-tight text-[42px] md:text-[52px]">Skills, everywhere at once.</h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-muted-foreground">
            Every <span className="font-mono text-[11px]">SKILL.md</span> installed across your agent
            tools, deduplicated by content. Copy a path, or see which tools already have it.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground/70">
          <span className="text-foreground">{data?.items.length ?? 0}</span> skills ·{" "}
          <span className="text-foreground">{totalInstalls}</span> installs
          {data && (
            <>
              {" "}
              · <span className="text-muted-foreground/50">{formatRelative(data.scannedAt)}</span>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-[420px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search skills by name, description or body…"
            className="h-9 pl-8 text-[13px]"
          />
        </div>
        {["claude", "codex", "cursor", "opencode"].map((id) => (
          <Button
            key={id}
            size="sm"
            variant={source === id ? "signal" : "outline"}
            onClick={() => setSource(source === id ? null : id)}
            className="font-mono text-[11px]"
          >
            {id}
          </Button>
        ))}
        {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>

      {!data && loading && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[180px] rounded-lg" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-border/70 px-6 py-16 text-center">
          <Sparkles className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-3 text-sm">No skills found in the scanned roots.</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
            check Sources → skill roots
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data?.items.map((skill) => (
          <article
            key={skill.id}
            className="group flex flex-col rounded-lg border border-border/70 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card"
          >
            <div className="flex items-start gap-2">
              <div className="grid size-7 shrink-0 place-items-center rounded-md border border-border/70 bg-secondary/60">
                <FolderTree className="size-3.5 text-signal/80" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[13px] font-medium">{skill.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {skill.installedIn.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                  {skill.installs > 1 && <Badge variant="signal">{skill.installs} installs</Badge>}
                </div>
              </div>
            </div>

            <p className="mt-3 line-clamp-4 text-[12px] leading-relaxed text-muted-foreground">
              {skill.description}
            </p>

            <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground/50">
              {skill.path.replace(/^\/Users\/[^/]+/, "~")}
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
              <span className="font-mono text-[10px] text-muted-foreground/50">
                {skill.files} files · {(skill.bytes / 1024).toFixed(1)} kB
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={async () => {
                  if (await copyText(skill.path)) {
                    setCopiedPath(skill.path);
                    setTimeout(() => setCopiedPath(null), 1400);
                    toast.success("Path copied");
                  }
                }}
                aria-label="Copy skill path"
              >
                {copiedPath === skill.path ? (
                  <Check className="size-3.5 text-signal" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

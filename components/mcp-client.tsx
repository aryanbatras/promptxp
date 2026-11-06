"use client";

import * as React from "react";
import { Check, Copy, FileCode2, Loader2, Plug, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, copyText } from "@/lib/client/api";
import type { McpServer } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

interface McpResponse {
  items: McpServer[];
  total: number;
  scannedAt: number;
  configFiles: string[];
  sources: string[];
}

const TRANSPORT_STYLES: Record<string, string> = {
  stdio: "border-border text-muted-foreground",
  http: "border-signal/40 text-signal",
  sse: "border-amber-500/40 text-amber-400",
  unknown: "border-border text-muted-foreground/60",
};

export function McpClient() {
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState<string | null>(null);
  const [data, setData] = React.useState<McpResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (source) params.set("source", source);
    setLoading(true);
    apiGet<McpResponse>(`/api/mcp?${params.toString()}`, controller.signal)
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, source]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="label-mono flex items-center gap-2">
        <span className="size-1 rounded-full bg-signal" />
        mcp registry
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-tight text-[42px] md:text-[52px]">One list of every MCP server.</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-muted-foreground">
            OpenCode, Claude, Cursor, Codex and Gemini each keep MCP configs in a different shape.
            PromptXP normalises them into one table and hands you a copy-paste snippet for any tool.
            Secret values are never read out — only the key names.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground/70">
          <span className="text-foreground">{data?.items.length ?? 0}</span> servers ·{" "}
          <span className="text-foreground">{data?.configFiles.length ?? 0}</span> config files
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
            placeholder="Search servers, commands, urls…"
            className="h-9 pl-8 text-[13px]"
          />
        </div>
        {(data?.sources ?? []).map((id) => (
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

      {data && data.configFiles.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="label-mono mr-1 text-[9px]">sources</span>
          {data.configFiles.map((file) => (
            <span
              key={file}
              className="inline-flex items-center gap-1 rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70"
            >
              <FileCode2 className="size-2.5" />
              {file.replace(/^\/Users\/[^/]+/, "~")}
            </span>
          ))}
        </div>
      )}

      {!data && loading && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[72px] rounded-lg" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mt-4 rounded-lg border border-dashed border-border/70 px-6 py-16 text-center">
          <Plug className="mx-auto size-5 text-muted-foreground/60" />
          <p className="mt-3 text-sm">No MCP servers found.</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/60">
            add one to{" "}
            <span className="text-foreground/70">~/.config/opencode/opencode.jsonc</span> and rescan
          </p>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-border/70">
        {data?.items.map((server) => (
          <div
            key={server.id}
            className="group grid grid-cols-1 gap-x-4 gap-y-2 border-b border-border/50 bg-card/40 px-4 py-3 transition-colors last:border-b-0 hover:bg-card md:grid-cols-[minmax(180px,1.1fr)_minmax(0,2fr)_auto]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium">{server.name}</span>
                <span
                  className={cn(
                    "rounded-sm border px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    TRANSPORT_STYLES[server.transport] ?? TRANSPORT_STYLES.unknown,
                  )}
                >
                  {server.transport}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge variant="muted">{server.sourceLabel}</Badge>
                <span className="truncate font-mono text-[10px] text-muted-foreground/50">
                  {server.configPath.replace(/^\/Users\/[^/]+/, "~")}
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] text-foreground/80">
                {server.transport === "stdio"
                  ? [server.command, ...(server.args ?? []).slice(0, 6)].filter(Boolean).join(" ")
                  : (server.url ?? "—")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {server.envKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded-sm bg-secondary/60 px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
                  >
                    env:{key}
                  </span>
                ))}
                {server.headerKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded-sm bg-secondary/60 px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
                  >
                    header:{key}
                  </span>
                ))}
                {server.hadSecrets && (
                  <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-amber-400/80">
                    <ShieldAlert className="size-2.5" /> values redacted
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 font-mono text-[10px]"
                onClick={async () => {
                  if (await copyText(server.snippet)) {
                    setCopied(server.id);
                    setTimeout(() => setCopied((value) => (value === server.id ? null : value)), 1500);
                    toast.success(`${server.name} snippet copied`, {
                      description: "Canonical mcpServers JSON with ${ENV} placeholders.",
                    });
                  }
                }}
              >
                {copied === server.id ? (
                  <Check className="size-3 text-signal" />
                ) : (
                  <Copy className="size-3" />
                )}
                {copied === server.id ? "copied" : "copy json"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

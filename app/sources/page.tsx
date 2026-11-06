import fs from "node:fs/promises";
import { Boxes, Database, FolderSearch, HardDrive, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MCP_CONFIG_TARGETS } from "@/lib/adapters/mcp";
import { HOME } from "@/lib/paths";
import { SKILL_ROOTS, displayPath, getSnapshot, summarise } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export default async function SourcesPage() {
  const snapshot = await getSnapshot();
  const summary = summarise(snapshot);

  const skillRoots = await Promise.all(
    SKILL_ROOTS.map(async (root) => ({ ...root, present: await exists(root.root) })),
  );
  const mcpTargets = await Promise.all(
    MCP_CONFIG_TARGETS.map(async (target) => ({
      ...target,
      path: `${HOME}/${target.rel}`,
      present: await exists(`${HOME}/${target.rel}`),
    })),
  );
  const foundMcp = mcpTargets.filter((target) => target.present);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="label-mono flex items-center gap-2">
        <span className="size-1 rounded-full bg-signal" />
        sources &amp; adapters
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-tight text-[42px] md:text-[52px]">Where the prompts come from.</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] text-muted-foreground">
            PromptXP reads agent storage directly and never writes to it. Nothing is uploaded, nothing
            is restarted, no session is touched.
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground/70">
          last scan {summary.durationMs}ms · {new Date(summary.scannedAt).toLocaleString()}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "prompts", value: summary.counts.prompts },
          { label: "sessions", value: summary.counts.sessions },
          { label: "skills", value: summary.counts.skills },
          { label: "mcp servers", value: summary.counts.mcp },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border/70 bg-card/40 px-3 py-2.5">
            <div className="label-mono text-[9px]">{stat.label}</div>
            <div className="mt-1 font-mono text-[20px] tabular-nums">
              {stat.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-signal/25 bg-signal/[0.04] px-3 py-2.5">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-signal" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <span className="text-foreground">Read-only contract.</span> The OpenCode database is opened
          with SQLite <span className="font-mono text-[11px]">readOnly</span>. Skill folders and MCP
          configs are only ever read. No credential value is returned by the API — only key names.
        </p>
      </div>

      <h2 className="label-mono mt-8 mb-2 flex items-center gap-2 text-[9px]">
        <Database className="size-3" /> detected tools
      </h2>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.sources.map((source) => (
          <div
            key={source.id}
            className="rounded-lg border border-border/70 bg-card/40 p-3.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={`size-1.5 rounded-full ${source.available ? "bg-signal" : "bg-muted-foreground/30"}`}
              />
              <span className="text-[13px] font-medium">{source.label}</span>
              <span className="ml-auto flex gap-1">
                {source.kind.map((kind) => (
                  <Badge key={kind} variant="muted">
                    {kind}
                  </Badge>
                ))}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-muted-foreground">
              <span>
                <span className="text-foreground/80">{source.promptCount}</span> prompts
              </span>
              <span>
                <span className="text-foreground/80">{source.skillCount}</span> skills
              </span>
              <span>
                <span className="text-foreground/80">{source.mcpCount}</span> mcp
              </span>
            </div>
            <ul className="mt-2 space-y-0.5">
              {source.roots.slice(0, 4).map((root) => (
                <li
                  key={root}
                  className="truncate font-mono text-[10px] text-muted-foreground/50"
                  title={root}
                >
                  {displayPath(root)}
                </li>
              ))}
              {source.roots.length > 4 && (
                <li className="font-mono text-[10px] text-muted-foreground/40">
                  +{source.roots.length - 4} more
                </li>
              )}
            </ul>
            {source.error && (
              <p className="mt-2 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-1 font-mono text-[10px] text-destructive">
                {source.error}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="label-mono mb-2 flex items-center gap-2 text-[9px]">
            <FolderSearch className="size-3" /> skill roots scanned
          </h2>
          <div className="overflow-hidden rounded-lg border border-border/70">
            {skillRoots.map((root) => (
              <div
                key={`${root.sourceId}-${root.root}`}
                className="flex items-center gap-2 border-b border-border/50 px-3 py-2 last:border-b-0"
              >
                <span
                  className={`size-1 shrink-0 rounded-full ${root.present ? "bg-signal" : "bg-muted-foreground/25"}`}
                />
                <span className="w-[86px] shrink-0 font-mono text-[10px] text-muted-foreground">
                  {root.sourceLabel}
                </span>
                <span className="truncate font-mono text-[10px] text-foreground/70">
                  {displayPath(root.root)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="label-mono mb-2 flex items-center gap-2 text-[9px]">
            <Boxes className="size-3" /> mcp configs scanned
            <span className="ml-auto text-muted-foreground/50">{foundMcp.length} found</span>
          </h2>
          <div className="overflow-hidden rounded-lg border border-border/70">
            {mcpTargets.map((target) => (
              <div
                key={target.rel}
                className="flex items-center gap-2 border-b border-border/50 px-3 py-2 last:border-b-0"
              >
                <span
                  className={`size-1 shrink-0 rounded-full ${target.present ? "bg-signal" : "bg-muted-foreground/25"}`}
                />
                <span className="w-[86px] shrink-0 font-mono text-[10px] text-muted-foreground">
                  {target.sourceLabel}
                </span>
                <span className="truncate font-mono text-[10px] text-foreground/70">
                  {displayPath(target.path)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 rounded-lg border border-border/70 bg-card/40 p-4">
        <div className="label-mono flex items-center gap-2 text-[9px]">
          <HardDrive className="size-3" /> coming next
        </div>
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-muted-foreground">
          The adapter interface is in place for the remaining session stores: Claude Code JSONL,
          Codex rollouts, Cursor, Kilo and Kimi. Each is one file in{" "}
          <span className="font-mono text-[11px]">lib/adapters</span> — the prompt schema, curation
          layer and API stay identical.
        </p>
      </div>
    </div>
  );
}

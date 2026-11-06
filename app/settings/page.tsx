import { Command, Cpu, Database, KeyRound, Terminal } from "lucide-react";
import { CopyBlock } from "@/components/copy-block";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { APP_VERSION, CACHE_PATH, DATA_DIR, HOME, STORE_PATH } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/context?format=markdown&limit=25",
    description: "Curated prompt digest for an agent to ingest as standing instructions.",
  },
  {
    method: "GET",
    path: "/api/prompts?q=design&starred=1&limit=50",
    description: "Search and filter the prompt library.",
  },
  {
    method: "GET",
    path: "/api/dna?format=markdown",
    description: "Engineering DNA: preferred stack, standing rules and working modes.",
  },
  {
    method: "GET",
    path: "/api/prompts/:id/template",
    description: "Generalize one prompt: project nouns become {{variables}}.",
  },
  {
    method: "GET",
    path: "/api/skills?q=ui",
    description: "Every installed skill, with path and source tool.",
  },
  {
    method: "GET",
    path: "/api/mcp",
    description: "Normalized MCP servers plus copy-ready config snippets.",
  },
  {
    method: "PATCH",
    path: "/api/prompts/:id",
    description: "Set starred, tags, collectionIds, note or hidden.",
  },
  {
    method: "POST",
    path: "/api/scan",
    description: "Force a full read-only rescan of every source.",
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="label-mono flex items-center gap-2">
        <span className="size-1 rounded-full bg-signal" />
        settings
      </div>
      <h1 className="display-tight mt-2 text-[42px] md:text-[52px]">Local by construction.</h1>
      <p className="mt-1.5 max-w-xl text-[13px] text-muted-foreground">
        PromptXP v{APP_VERSION}. One process, one SQLite-free JSON store, no network calls out.
      </p>

      <section className="mt-7">
        <h2 className="label-mono mb-2 flex items-center gap-2 text-[9px]">
          <Database className="size-3" /> storage
        </h2>
        <div className="overflow-hidden rounded-lg border border-border/70">
          {[
            { label: "home", value: HOME },
            { label: "curation store", value: STORE_PATH },
            { label: "scan cache", value: CACHE_PATH },
            { label: "data directory", value: DATA_DIR },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-b-0"
            >
              <span className="label-mono w-[110px] shrink-0 text-[9px]">{row.label}</span>
              <span className="truncate font-mono text-[11px] text-foreground/75">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          Curation (stars, tags, folders, notes) lives in{" "}
          <span className="font-mono text-[10px]">data.json</span> and survives rescans because prompt
          ids are content-addressed. Delete the data directory to start clean.
        </p>
      </section>

      <section id="api" className="mt-8 scroll-mt-20">
        <h2 className="label-mono mb-2 flex items-center gap-2 text-[9px]">
          <Terminal className="size-3" /> agent api
        </h2>
        <p className="mb-3 max-w-2xl text-[12px] text-muted-foreground">
          Everything the dashboard does is an HTTP call. Point any agent at the running server — this
          is the part that turns PromptXP from a viewer into a prompt layer.
        </p>

        <div className="space-y-2">
          {ENDPOINTS.map((endpoint) => (
            <div key={endpoint.path} className="rounded-lg border border-border/70 bg-card/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={endpoint.method === "GET" ? "outline" : "signal"}>
                  {endpoint.method}
                </Badge>
                <code className="font-mono text-[11px] text-foreground/85">{endpoint.path}</code>
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground">{endpoint.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          <CopyBlock
            label="give this to any agent"
            value={`curl -s "http://localhost:4310/api/context?format=markdown&limit=25"`}
          />
          <CopyBlock
            label="mcp bridge — register once, then agents call your vault directly"
            value={JSON.stringify(
              {
                mcp: {
                  servers: {
                    promptxp: {
                      type: "local",
                      command: ["node", `${process.cwd()}/bin/promptxp-mcp.mjs`],
                    },
                  },
                },
              },
              null,
              2,
            )}
          />
          <CopyBlock
            label="star everything with a tag"
            value={`curl -s "http://localhost:4310/api/prompts?tag=house-style&limit=100" | jq '.items[].id'`}
          />
        </div>
      </section>

      <Separator className="my-8" />

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-card/40 p-4">
          <h2 className="label-mono flex items-center gap-2 text-[9px]">
            <KeyRound className="size-3" /> safety
          </h2>
          <ul className="mt-2 space-y-1.5 text-[12px] text-muted-foreground">
            <li>· Server binds to localhost; no tunnel, no telemetry.</li>
            <li>· MCP env values and auth headers are never serialized.</li>
            <li>· Agent storage is opened read-only and never mutated.</li>
            <li>· No prompt leaves this machine unless you copy it.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/40 p-4">
          <h2 className="label-mono flex items-center gap-2 text-[9px]">
            <Command className="size-3" /> shortcuts
          </h2>
          <ul className="mt-2 space-y-1.5 text-[12px] text-muted-foreground">
            <li>
              <span className="font-mono text-[11px] text-foreground/80">⌘K</span> or{" "}
              <span className="font-mono text-[11px] text-foreground/80">/</span> — focus search
            </li>
            <li>
              <span className="font-mono text-[11px] text-foreground/80">Enter</span> — commit a tag
            </li>
            <li>
              Cards, compact and full views are one keystroke apart in the toolbar.
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-4 flex items-start gap-2 rounded-lg border border-border/70 bg-card/40 p-4">
        <Cpu className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <span className="text-foreground">Next up:</span> session adapters for Claude Code, Codex and
          Cursor; prompt variables; export to <span className="font-mono text-[11px]">AGENTS.md</span>;
          then the cloud layer — <span className="font-mono text-[11px]">promptxp.dev/&lt;you&gt;/&lt;tool&gt;</span>{" "}
          for agents that cannot see your disk.
        </p>
      </section>
    </div>
  );
}

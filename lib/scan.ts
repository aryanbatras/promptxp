import fs from "node:fs/promises";
import path from "node:path";
import { opencodeAdapter } from "./adapters/opencode";
import { scanSkillRoot, type SkillRootSpec } from "./adapters/skills";
import { MCP_CONFIG_TARGETS, scanMcpConfigs } from "./adapters/mcp";
import { isDir } from "./adapters/types";
import { CACHE_PATH, DATA_DIR, HOME } from "./paths";
import type { McpServer, Prompt, ScanSnapshot, Skill, SourceStatus } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_VERSION = 2;

interface CacheFile {
  version: number;
  snapshot: ScanSnapshot;
}

export const SKILL_ROOTS: SkillRootSpec[] = [
  { sourceId: "claude", sourceLabel: "Claude Code", root: path.join(HOME, ".claude/skills") },
  { sourceId: "codex", sourceLabel: "Codex", root: path.join(HOME, ".codex/skills") },
  { sourceId: "cursor", sourceLabel: "Cursor", root: path.join(HOME, ".cursor/skills") },
  { sourceId: "opencode", sourceLabel: "OpenCode", root: path.join(HOME, ".config/opencode/skills") },
  { sourceId: "opencode", sourceLabel: "OpenCode", root: path.join(HOME, ".opencode/skills") },
  { sourceId: "gemini", sourceLabel: "Gemini CLI", root: path.join(HOME, ".gemini/skills") },
  { sourceId: "claude", sourceLabel: "Agents", root: path.join(HOME, ".agents/skills") },
];

const SOURCE_LABELS: Record<string, string> = {
  opencode: "OpenCode",
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  gemini: "Gemini CLI",
  "claude-desktop": "Claude Desktop",
};

let memory: ScanSnapshot | null = null;
let inflight: Promise<ScanSnapshot> | null = null;

function labelFor(id: string) {
  return SOURCE_LABELS[id] ?? id;
}

export function displayPath(target: string): string {
  if (target.startsWith(HOME)) return `~${target.slice(HOME.length)}`;
  return target;
}

async function buildSources(
  prompts: Prompt[],
  skills: Skill[],
  mcp: McpServer[],
  errors: Map<string, string>,
): Promise<SourceStatus[]> {
  const ids = new Set<string>([
    "opencode",
    ...skills.map((s) => s.sourceId),
    ...mcp.map((s) => s.sourceId),
    ...MCP_CONFIG_TARGETS.map((t) => t.sourceId),
    ...SKILL_ROOTS.map((r) => r.sourceId),
  ]);

  const sources: SourceStatus[] = [];
  for (const id of ids) {
    const roots: string[] = [];
    if (id === "opencode") roots.push(...opencodeAdapter.roots(HOME));
    for (const root of SKILL_ROOTS.filter((r) => r.sourceId === id)) roots.push(root.root);
    for (const target of MCP_CONFIG_TARGETS.filter((t) => t.sourceId === id)) {
      roots.push(path.join(HOME, target.rel));
    }
    let available = false;
    for (const root of roots) {
      try {
        await fs.access(root);
        available = true;
        break;
      } catch {
        /* keep looking */
      }
    }
    const kind: SourceStatus["kind"] = [];
    if (id === "opencode") kind.push("prompts");
    if (SKILL_ROOTS.some((r) => r.sourceId === id)) kind.push("skills");
    if (MCP_CONFIG_TARGETS.some((t) => t.sourceId === id)) kind.push("mcp");
    sources.push({
      id,
      label: labelFor(id),
      kind,
      available,
      roots: roots.map(displayPath),
      promptCount: prompts.filter((p) => p.sourceId === id).length,
      skillCount: skills.filter((s) => s.sourceId === id).length,
      mcpCount: mcp.filter((s) => s.sourceId === id).length,
      error: errors.get(id),
    });
  }
  return sources.sort((a, b) => Number(b.available) - Number(a.available) || a.label.localeCompare(b.label));
}

async function doScan(): Promise<ScanSnapshot> {
  const started = Date.now();
  const errors = new Map<string, string>();

  let prompts: Prompt[] = [];
  try {
    prompts = await opencodeAdapter.scanPrompts!(HOME);
  } catch (error) {
    errors.set("opencode", (error as Error).message);
  }

  const skillBuckets = await Promise.all(
    SKILL_ROOTS.map(async (spec) => {
      try {
        return await scanSkillRoot(spec);
      } catch (error) {
        errors.set(spec.sourceId, (error as Error).message);
        return [];
      }
    }),
  );
  const skills = Array.from(
    new Map(skillBuckets.flat().map((skill) => [skill.path, skill])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  let mcp: McpServer[] = [];
  try {
    const scan = await scanMcpConfigs(HOME);
    mcp = scan.servers;
    for (const file of scan.files) {
      if (file.error) errors.set(file.sourceId, `${file.path}: ${file.error}`);
    }
  } catch (error) {
    errors.set("mcp", (error as Error).message);
  }

  const sources = await buildSources(prompts, skills, mcp, errors);
  const snapshot: ScanSnapshot = {
    scannedAt: Date.now(),
    durationMs: Date.now() - started,
    prompts,
    skills,
    mcp,
    sources,
  };

  memory = snapshot;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const payload: CacheFile = { version: CACHE_VERSION, snapshot };
    const tmp = `${CACHE_PATH}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload), "utf8");
    await fs.rename(tmp, CACHE_PATH);
  } catch {
    /* cache is an optimisation; never fail a scan on it */
  }
  return snapshot;
}

async function readCache(): Promise<ScanSnapshot | null> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed.version !== CACHE_VERSION || !parsed.snapshot) return null;
    return parsed.snapshot;
  } catch {
    return null;
  }
}

export interface SnapshotOptions {
  force?: boolean;
}

export async function getSnapshot(options: SnapshotOptions = {}): Promise<ScanSnapshot> {
  if (!options.force) {
    if (memory && Date.now() - memory.scannedAt < CACHE_TTL_MS) return memory;
    if (!memory) {
      const cached = await readCache();
      if (cached) {
        memory = cached;
        if (Date.now() - cached.scannedAt < CACHE_TTL_MS) return cached;
      }
    }
  }
  if (inflight) return inflight;
  inflight = doScan().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Cached snapshot if we have one — never triggers a scan. */
export async function peekSnapshot(): Promise<ScanSnapshot | null> {
  if (memory) return memory;
  const cached = await readCache();
  if (cached) memory = cached;
  return memory;
}

export async function isStale(): Promise<boolean> {
  const snapshot = await peekSnapshot();
  return !snapshot || Date.now() - snapshot.scannedAt > CACHE_TTL_MS;
}

export function summarise(snapshot: ScanSnapshot) {
  return {
    scannedAt: snapshot.scannedAt,
    durationMs: snapshot.durationMs,
    counts: {
      prompts: snapshot.prompts.length,
      skills: snapshot.skills.length,
      mcp: snapshot.mcp.length,
      projects: new Set(snapshot.prompts.map((p) => p.projectPath).filter(Boolean)).size,
      sessions: new Set(snapshot.prompts.map((p) => p.sessionId)).size,
      sources: snapshot.sources.filter((s) => s.available).length,
    },
  };
}

export { isDir };

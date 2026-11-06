import fs from "node:fs/promises";
import path from "node:path";
import { hash, promptId } from "../hash";
import { cleanPromptText, sieve } from "../sieve";
import type { Prompt } from "../types";
import { exists, safeRead, type Adapter } from "./types";

const SOURCE_ID = "opencode";
const SOURCE_LABEL = "OpenCode";
const DB_RELATIVE = ".local/share/opencode/opencode.db";
const STORAGE_RELATIVE = ".local/share/opencode/storage";
const MAX_PROMPTS = 20_000;

interface RawRow {
  id: string;
  session_id: string;
  time_created: number;
  data: string;
  title?: string | null;
  directory?: string | null;
  agent?: string | null;
  model?: string | null;
  project_name?: string | null;
}

function projectNameFrom(directory: string | null | undefined, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim();
  if (!directory) return "unknown";
  const trimmed = directory.replace(/\/+$/, "");
  return path.basename(trimmed) || trimmed;
}

function modelOf(data: Record<string, any>): string | undefined {
  const meta = data.metadata?.model;
  const direct = data.model;
  const id = meta?.modelID ?? direct?.modelID;
  const provider = meta?.providerID ?? direct?.providerID;
  if (!id) return undefined;
  return provider ? `${provider}/${id}` : id;
}

function userTextOf(data: Record<string, any>): string {
  const text = typeof data.text === "string" ? data.text : "";
  const display = typeof data.metadata?.displayText === "string" ? data.metadata.displayText : "";
  return (text || display).trim();
}

function toPrompt(row: RawRow, messageId: string, rawText: string, parsed: Record<string, any>): Prompt {
  const text = cleanPromptText(rawText);
  const verdict = sieve(text);
  const createdAt = Number(parsed.time?.created ?? row.time_created) || Date.now();
  const attachments =
    (Array.isArray(parsed.files) ? parsed.files.length : 0) +
    (Array.isArray(parsed.metadata?.attachments) ? parsed.metadata.attachments.length : 0);
  return {
    id: promptId(SOURCE_ID, row.session_id, messageId),
    sourceId: SOURCE_ID,
    sourceLabel: SOURCE_LABEL,
    sessionId: row.session_id,
    sessionTitle: (row.title || "").trim() || "Untitled session",
    projectPath: row.directory || "",
    projectName: projectNameFrom(row.directory, row.project_name),
    text,
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    hash: hash(text),
    createdAt,
    quality: verdict.quality,
    kind: verdict.kind,
    signal: verdict.signal,
    agent: parsed.metadata?.agent ?? parsed.agent ?? row.agent ?? undefined,
    model: modelOf(parsed) ?? row.model ?? undefined,
    attachments,
  };
}

function dedupe(prompts: Prompt[]): Prompt[] {
  const byKey = new Map<string, Prompt>();
  for (const prompt of prompts) {
    const key = `${prompt.sourceId}:${prompt.sessionId}:${prompt.hash}`;
    const existing = byKey.get(key);
    if (!existing || existing.createdAt < prompt.createdAt) byKey.set(key, prompt);
  }
  return Array.from(byKey.values()).sort((a, b) => b.createdAt - a.createdAt);
}

async function tableNames(db: any): Promise<Set<string>> {
  const rows = db
    .prepare("select name from sqlite_master where type='table'")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

async function scanDatabase(dbPath: string): Promise<Prompt[]> {
  const { DatabaseSync } = (await import("node:sqlite")) as any;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const tables = await tableNames(db);
    const prompts: Prompt[] = [];

    if (tables.has("session_message")) {
      const hasSessionV2 = tables.has("session_v2");
      const hasProject = tables.has("project");
      const hasSession = tables.has("session");
      const sql = `
        select m.id as id, m.session_id as session_id, m.time_created as time_created, m.data as data,
               ${hasSessionV2 ? "s2.title" : "null"} as title,
               ${hasSessionV2 ? "s2.directory" : hasSession ? "s1.directory" : "null"} as directory,
               ${hasSessionV2 ? "s2.agent" : "null"} as agent,
               ${hasSessionV2 ? "s2.model" : "null"} as model,
               ${hasProject ? "p.name" : "null"} as project_name
        from session_message m
        ${hasSessionV2 ? "left join session_v2 s2 on s2.id = m.session_id" : ""}
        ${hasSession ? "left join session s1 on s1.id = m.session_id" : ""}
        ${hasProject && hasSessionV2 ? "left join project p on p.id = s2.project_id" : ""}
        where m.type = 'user'
        order by m.time_created desc
        limit ${MAX_PROMPTS}
      `;
      for (const row of db.prepare(sql).all() as RawRow[]) {
        let parsed: Record<string, any>;
        try {
          parsed = JSON.parse(row.data);
        } catch {
          continue;
        }
        const text = userTextOf(parsed);
        if (!text) continue;
        prompts.push(toPrompt(row, row.id, text, parsed));
      }
    }

    // Legacy schema: message rows joined with text parts.
    if (tables.has("message") && tables.has("part")) {
      const messages = db
        .prepare(
          `select id, session_id, time_created, data from message
           where data like '%"role":"user"%'
           order by time_created desc limit ${MAX_PROMPTS}`,
        )
        .all() as RawRow[];
      if (messages.length) {
        const ids = messages.map((m) => m.id);
        const parts = new Map<string, string[]>();
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          const placeholders = chunk.map(() => "?").join(",");
          const rows = db
            .prepare(
              `select message_id, data from part
               where message_id in (${placeholders}) and data like '%"type":"text"%'
               order by time_created asc`,
            )
            .all(...chunk) as Array<{ message_id: string; data: string }>;
          for (const part of rows) {
            try {
              const parsed = JSON.parse(part.data);
              if (parsed.type !== "text" || typeof parsed.text !== "string") continue;
              const list = parts.get(part.message_id) ?? [];
              list.push(parsed.text);
              parts.set(part.message_id, list);
            } catch {
              /* ignore malformed part */
            }
          }
        }
        const titles = new Map<string, { title: string; directory: string }>();
        if (tables.has("session")) {
          for (const row of db
            .prepare("select id, title, directory from session")
            .all() as Array<{ id: string; title: string; directory: string }>) {
            titles.set(row.id, { title: row.title, directory: row.directory });
          }
        }
        for (const row of messages) {
          const text = (parts.get(row.id) ?? []).join("\n\n").trim();
          if (!text) continue;
          let parsed: Record<string, any> = {};
          try {
            parsed = JSON.parse(row.data);
          } catch {
            /* keep empty */
          }
          const meta = titles.get(row.session_id);
          prompts.push(
            toPrompt(
              { ...row, title: meta?.title, directory: meta?.directory },
              row.id,
              text,
              parsed,
            ),
          );
        }
      }
    }

    return dedupe(prompts);
  } finally {
    db.close();
  }
}

/** Older OpenCode builds kept sessions as JSON files. Read-only, best effort. */
async function scanJsonStorage(root: string): Promise<Prompt[]> {
  const messageDir = path.join(root, "storage", "message");
  if (!(await exists(messageDir))) return [];
  const prompts: Prompt[] = [];
  const sessions = new Map<string, { title: string; directory: string }>();
  const sessionDir = path.join(root, "storage", "session");
  try {
    for (const project of await fs.readdir(sessionDir)) {
      const projectDir = path.join(sessionDir, project);
      if (!(await fs.stat(projectDir).catch(() => null))?.isDirectory()) continue;
      for (const file of await fs.readdir(projectDir)) {
        if (!file.endsWith(".json")) continue;
        const raw = await safeRead(path.join(projectDir, file));
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.id) {
            sessions.set(parsed.id, {
              title: parsed.title ?? "Untitled session",
              directory: parsed.directory ?? "",
            });
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* sessions are optional */
  }

  try {
    for (const sessionId of await fs.readdir(messageDir)) {
      const dir = path.join(messageDir, sessionId);
      if (!(await fs.stat(dir).catch(() => null))?.isDirectory()) continue;
      for (const file of await fs.readdir(dir)) {
        if (!file.endsWith(".json")) continue;
        const raw = await safeRead(path.join(dir, file));
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.role !== "user") continue;
          const text = userTextOf(parsed);
          if (!text) continue;
          const meta = sessions.get(sessionId);
          prompts.push(
            toPrompt(
              {
                id: parsed.id ?? file.replace(".json", ""),
                session_id: sessionId,
                time_created: parsed.time?.created ?? Date.now(),
                data: raw,
                title: meta?.title,
                directory: meta?.directory,
              },
              parsed.id ?? file.replace(".json", ""),
              text,
              parsed,
            ),
          );
        } catch {
          /* ignore malformed */
        }
      }
    }
  } catch {
    /* unreadable message store */
  }
  return dedupe(prompts);
}

export const opencodeAdapter: Adapter = {
  id: SOURCE_ID,
  label: SOURCE_LABEL,
  kind: ["prompts"],
  roots: (home) => [path.join(home, DB_RELATIVE), path.join(home, STORAGE_RELATIVE)],
  async isAvailable(home) {
    return (await exists(path.join(home, DB_RELATIVE))) || (await exists(path.join(home, STORAGE_RELATIVE)));
  },
  async scanPrompts(home) {
    const dbPath = path.join(home, DB_RELATIVE);
    if (await exists(dbPath)) {
      try {
        return await scanDatabase(dbPath);
      } catch (error) {
        const fallback = await scanJsonStorage(path.join(home, ".local/share/opencode"));
        if (fallback.length) return fallback;
        throw new Error(
          `Could not read opencode.db read-only: ${(error as Error).message}`,
        );
      }
    }
    return scanJsonStorage(path.join(home, ".local/share/opencode"));
  },
};

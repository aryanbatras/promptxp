import fs from "node:fs/promises";
import path from "node:path";
import { hash } from "../hash";
import type { Skill } from "../types";
import { exists, isDir, safeRead } from "./types";

interface Frontmatter {
  name?: string;
  description?: string;
  [key: string]: string | undefined;
}

function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };
  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\r?\n/, "");
  const meta: Frontmatter = {};
  const lines = block.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();

    // YAML block scalar: `description: >-` plus indented continuation lines.
    if (/^[>|][+-]?$/.test(value)) {
      const folded = value.startsWith(">");
      const parts: string[] = [];
      while (index + 1 < lines.length && /^\s+\S/.test(lines[index + 1])) {
        parts.push(lines[index + 1].trim());
        index += 1;
      }
      meta[key] = parts.join(folded ? " " : "\n");
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, body };
}

async function countFiles(dir: string, budget = 400): Promise<number> {
  let count = 0;
  const stack = [dir];
  while (stack.length && count < budget) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
      else count += 1;
      if (count >= budget) break;
    }
  }
  return count;
}

export interface SkillRootSpec {
  sourceId: string;
  sourceLabel: string;
  root: string;
  scope?: "global" | "project";
}

export async function scanSkillRoot(spec: SkillRootSpec): Promise<Skill[]> {
  if (!(await isDir(spec.root))) return [];
  let entries;
  try {
    entries = await fs.readdir(spec.root, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(spec.root, entry.name);
    let skillFile: string | null = null;
    if (entry.isDirectory()) {
      for (const candidate of ["SKILL.md", "skill.md", "README.md"]) {
        const target = path.join(full, candidate);
        if (await exists(target)) {
          skillFile = target;
          break;
        }
      }
    } else if (entry.name.toLowerCase().endsWith(".md")) {
      skillFile = full;
    }
    if (!skillFile) continue;
    const raw = await safeRead(skillFile);
    if (!raw) continue;
    const { meta, body } = parseFrontmatter(raw);
    let stat: { size: number; mtimeMs: number } | null = null;
    try {
      stat = await fs.stat(skillFile);
    } catch {
      /* ignore */
    }
    const dirName = entry.isDirectory() ? entry.name : entry.name.replace(/\.md$/i, "");
    const content = raw.trim();
    const preview = body
      .replace(/^#+\s*/gm, "")
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 320);
    skills.push({
      id: `s_${hash(`${spec.sourceId}:${skillFile}`).slice(0, 16)}`,
      name: meta.name?.trim() || dirName,
      description:
        meta.description?.trim() ||
        preview.split(". ").slice(0, 1).join(". ").slice(0, 200) ||
        "No description",
      bodyPreview: preview,
      sourceId: spec.sourceId,
      sourceLabel: spec.sourceLabel,
      path: skillFile,
      root: spec.root,
      scope: spec.scope ?? "global",
      files: entry.isDirectory() ? await countFiles(full) : 1,
      bytes: stat?.size ?? Buffer.byteLength(content),
      hash: hash(content),
      updatedAt: stat?.mtimeMs ?? Date.now(),
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

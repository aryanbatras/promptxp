import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer, Prompt, Skill, SourceStatus } from "../types";

export interface Adapter {
  id: string;
  label: string;
  kind: Array<"prompts" | "skills" | "mcp">;
  roots(home: string): string[];
  isAvailable(home: string): Promise<boolean>;
  scanPrompts?(home: string): Promise<Prompt[]>;
  scanSkills?(home: string): Promise<Skill[]>;
  scanMcp?(home: string): Promise<McpServer[]>;
  status?(home: string): Promise<Partial<SourceStatus>>;
}

export async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function isDir(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

export async function safeRead(target: string): Promise<string | null> {
  try {
    return await fs.readFile(target, "utf8");
  } catch {
    return null;
  }
}

export function expandHome(home: string, target: string): string {
  if (target.startsWith("~/")) return path.join(home, target.slice(2));
  return target;
}

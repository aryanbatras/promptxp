import path from "node:path";
import { hash } from "../hash";
import type { McpServer, McpTransport } from "../types";
import { exists, safeRead } from "./types";

interface ConfigTarget {
  rel: string;
  sourceId: string;
  sourceLabel: string;
}

/** Every MCP-bearing config PromptXP knows how to read. Read-only. */
export const MCP_CONFIG_TARGETS: ConfigTarget[] = [
  { rel: ".config/opencode/opencode.jsonc", sourceId: "opencode", sourceLabel: "OpenCode" },
  { rel: ".config/opencode/opencode.json", sourceId: "opencode", sourceLabel: "OpenCode" },
  { rel: ".config/opencode/mcp-servers.json", sourceId: "opencode", sourceLabel: "OpenCode" },
  { rel: ".opencode/opencode.json", sourceId: "opencode", sourceLabel: "OpenCode" },
  { rel: ".claude.json", sourceId: "claude", sourceLabel: "Claude Code" },
  { rel: ".claude/settings.json", sourceId: "claude", sourceLabel: "Claude Code" },
  {
    rel: "Library/Application Support/Claude/claude_desktop_config.json",
    sourceId: "claude-desktop",
    sourceLabel: "Claude Desktop",
  },
  { rel: ".cursor/mcp.json", sourceId: "cursor", sourceLabel: "Cursor" },
  { rel: ".codex/config.toml", sourceId: "codex", sourceLabel: "Codex" },
  { rel: ".gemini/settings.json", sourceId: "gemini", sourceLabel: "Gemini CLI" },
];

const SECRET_QUERY_RE = /([?&](?:token|key|api_key|apikey|secret|access_token|auth)=)[^&]*/gi;

export function redactUrl(url: string): string {
  return url.replace(SECRET_QUERY_RE, "$1[redacted]");
}

/** Strip // and block comments plus trailing commas from JSONC without touching strings. */
export function parseJsonc(raw: string): any {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];
    if (inString) {
      out += char;
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (i < raw.length && raw[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < raw.length && !(raw[i] === "*" && raw[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    out += char;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

function quotedStrings(value: string): string[] {
  const matches = value.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g) ?? [];
  return matches.map((m) => m.slice(1, -1).replace(/\\(.)/g, "$1"));
}

function parseCodexToml(raw: string): Record<string, any> {
  const servers: Record<string, any> = {};
  let current: any = null;
  let currentEnv: any = null;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const section = trimmed.match(/^\[mcp_servers\.([A-Za-z0-9_.-]+?)(?:\.env)?\]$/);
    if (section) {
      const name = section[1];
      if (trimmed.endsWith(".env]")) {
        servers[name] = servers[name] ?? {};
        currentEnv = {};
        servers[name].env = currentEnv;
        current = null;
      } else {
        servers[name] = servers[name] ?? {};
        current = servers[name];
        currentEnv = null;
      }
      continue;
    }
    if (trimmed.startsWith("[")) {
      current = null;
      currentEnv = null;
      continue;
    }
    const kv = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    const value = rawValue.trim();
    if (currentEnv) {
      currentEnv[key] = quotedStrings(value)[0] ?? value.replace(/^["']|["']$/g, "");
    } else if (current) {
      if (value.startsWith("[")) current[key] = quotedStrings(value);
      else if (value.startsWith("{")) {
        const obj: Record<string, string> = {};
        for (const pair of value.slice(1, -1).split(",")) {
          const [k, v] = pair.split("=");
          if (!k || v === undefined) continue;
          obj[k.trim()] = quotedStrings(v)[0] ?? v.trim().replace(/^["']|["']$/g, "");
        }
        current[key] = obj;
      } else if (value === "true" || value === "false") current[key] = value === "true";
      else current[key] = quotedStrings(value)[0] ?? value.replace(/^["']|["']$/g, "");
    }
  }
  return servers;
}

function collectServerMaps(config: any): Array<{ servers: Record<string, any>; keyPath: string }> {
  const found: Array<{ servers: Record<string, any>; keyPath: string }> = [];
  const candidates: Array<[string, any]> = [
    ["mcpServers", config?.mcpServers],
    ["mcp_servers", config?.mcp_servers],
    ["servers", config?.servers],
    ["mcp.servers", config?.mcp?.servers],
    ["servers.mcp", config?.servers?.mcp],
    ["mcp.servers", config?.mcp?.mcpServers],
  ];
  for (const [keyPath, value] of candidates) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      found.push({ servers: value, keyPath });
    }
  }
  // OpenCode also allows a bare `mcp` block of server definitions.
  if (config?.mcp && typeof config.mcp === "object" && !Array.isArray(config.mcp)) {
    const values = Object.values(config.mcp);
    const looksLikeServers =
      values.length > 0 &&
      values.every(
        (v) =>
          v &&
          typeof v === "object" &&
          ("command" in (v as any) || "url" in (v as any) || "type" in (v as any)),
      );
    if (looksLikeServers) found.push({ servers: config.mcp, keyPath: "mcp" });
  }
  return found;
}

function normalizeTransport(raw: any): McpTransport {
  const type = typeof raw?.type === "string" ? raw.type.toLowerCase() : "";
  if (type.includes("sse")) return "sse";
  if (type.includes("http") || type.includes("remote") || type.includes("streamable")) {
    return raw?.url ? "http" : "unknown";
  }
  if (raw?.url) return raw.url.startsWith("sse") ? "sse" : "http";
  if (raw?.command) return "stdio";
  return "unknown";
}

function normalizeCommand(raw: any): { command?: string; args?: string[] } {
  const command = raw?.command;
  if (Array.isArray(command)) {
    const [head, ...rest] = command.map(String);
    const shellWrapped = /(^|\/)(zsh|bash|sh)$/.test(head ?? "");
    if (shellWrapped && rest[0] === "-c" && rest.length === 2) {
      // `/bin/zsh -lc "npx -y pkg"` → unwrap for readability.
      const inner = rest[1].split(/\s+/);
      return { command: inner[0], args: inner.slice(1) };
    }
    return { command: head, args: rest };
  }
  if (typeof command === "string") {
    return {
      command,
      args: Array.isArray(raw?.args) ? raw.args.map(String) : undefined,
    };
  }
  return {};
}

function sanitizeSnippet(entry: any, name: string, transport: McpTransport) {
  const envKeys = Object.keys(entry?.env ?? entry?.environment ?? {});
  const headerKeys = Object.keys(entry?.headers ?? {});
  const command = normalizeCommand(entry);
  if (transport === "stdio" || command.command) {
    return {
      mcpServers: {
        [name]: {
          command: command.command,
          ...(command.args?.length ? { args: command.args } : {}),
          ...(envKeys.length
            ? { env: Object.fromEntries(envKeys.map((k) => [k, `\${${k}}`])) }
            : {}),
        },
      },
    };
  }
  return {
    mcpServers: {
      [name]: {
        ...(transport === "sse" ? { type: "sse" } : {}),
        url: entry?.url ? redactUrl(String(entry.url)) : "",
        ...(headerKeys.length
          ? { headers: Object.fromEntries(headerKeys.map((k) => [k, `\${${k}}`])) }
          : {}),
      },
    },
  };
}

function toMcpServers(
  servers: Record<string, any>,
  target: ConfigTarget,
  configPath: string,
): McpServer[] {
  const result: McpServer[] = [];
  for (const [name, entry] of Object.entries(servers)) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as any;
    const transport = normalizeTransport(raw);
    const { command, args } = normalizeCommand(raw);
    const env = raw.env ?? raw.environment ?? {};
    const headers = raw.headers ?? raw.http_headers ?? {};
    const envKeys = Object.keys(env ?? {});
    const headerKeys = Object.keys(headers ?? {});
    const hadSecrets =
      envKeys.some((key) => typeof (env as any)[key] === "string" && (env as any)[key].length > 0) ||
      headerKeys.some(
        (key) => typeof (headers as any)[key] === "string" && (headers as any)[key].length > 0,
      );
    result.push({
      id: `m_${hash(`${target.sourceId}:${configPath}:${name}`).slice(0, 16)}`,
      name,
      sourceId: target.sourceId,
      sourceLabel: target.sourceLabel,
      transport,
      command,
      args,
      url: raw.url ? redactUrl(String(raw.url)) : undefined,
      envKeys,
      headerKeys,
      hadSecrets,
      configPath,
      snippet: JSON.stringify(sanitizeSnippet(raw, name, transport), null, 2),
      updatedAt: Date.now(),
    });
  }
  return result;
}

export async function scanMcpConfigs(home: string): Promise<{
  servers: McpServer[];
  files: Array<{ path: string; sourceId: string; sourceLabel: string; serverCount: number; error?: string }>;
}> {
  const servers: McpServer[] = [];
  const files: Array<{
    path: string;
    sourceId: string;
    sourceLabel: string;
    serverCount: number;
    error?: string;
  }> = [];

  for (const target of MCP_CONFIG_TARGETS) {
    const configPath = path.join(home, target.rel);
    if (!(await exists(configPath))) continue;
    const raw = await safeRead(configPath);
    if (!raw) continue;
    try {
      let config: any;
      if (configPath.endsWith(".toml")) {
        config = { mcp_servers: parseCodexToml(raw) };
      } else {
        config = parseJsonc(raw);
      }
      const maps = collectServerMaps(config);
      let count = 0;
      for (const { servers: map } of maps) {
        const parsed = toMcpServers(map, target, configPath);
        count += parsed.length;
        servers.push(...parsed);
      }
      files.push({
        path: configPath,
        sourceId: target.sourceId,
        sourceLabel: target.sourceLabel,
        serverCount: count,
      });
    } catch (error) {
      files.push({
        path: configPath,
        sourceId: target.sourceId,
        sourceLabel: target.sourceLabel,
        serverCount: 0,
        error: (error as Error).message,
      });
    }
  }

  const deduped = Array.from(
    new Map(servers.map((server) => [`${server.sourceId}:${server.name}`, server])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return { servers: deduped, files };
}

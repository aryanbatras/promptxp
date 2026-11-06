#!/usr/bin/env node
/**
 * PromptXP MCP server (stdio).
 *
 * Lets any MCP-capable agent read your curated prompt library without a browser:
 *   { "mcp": { "servers": { "promptxp": { "type": "local",
 *       "command": ["node", "/path/to/bin/promptxp-mcp.mjs"] } } } }
 *
 * It talks to the local PromptXP server over loopback. Nothing leaves the machine.
 */
import readline from "node:readline";

const BASE = process.env.PROMPTXP_URL || "http://127.0.0.1:4310";
const VERSION = "0.2.0";

const TOOLS = [
  {
    name: "get_engineering_dna",
    description:
      "Return this developer's aggregated engineering defaults: preferred stack, standing rules and working modes, derived from their curated prompts. Call this before starting work in a new project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_prompt_context",
    description:
      "Return a markdown brief of the developer's curated standing prompts (starred and tagged first). Use as durable style and architecture guidance.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum prompts to include (default 25, max 100)." },
        tag: { type: "string", description: "Optional tag filter, e.g. house-style." },
        query: { type: "string", description: "Optional free-text filter." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "search_prompts",
    description:
      "Search the developer's past prompts from real coding sessions. Returns prompt text, project, tags, kind and a quality score. Use for 'how did I ask for X before'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        tag: { type: "string" },
        kind: {
          type: "string",
          enum: ["kickoff", "spec", "fix", "question", "chat"],
          description: "Filter by prompt type.",
        },
        min_quality: { type: "number", description: "0-100 usefulness floor." },
        limit: { type: "number", description: "Default 10, max 50." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_prompt",
    description:
      "Fetch one prompt by id, optionally generalized into a {{variable}} template with project nouns stripped.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        as_template: { type: "boolean" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_skills",
    description:
      "List installed agent skills (SKILL.md) across Claude Code, Codex, Cursor and OpenCode, with their paths.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "list_mcp_servers",
    description:
      "List every MCP server configured in any local agent tool, normalized, with a copy-ready snippet.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      additionalProperties: false,
    },
  },
];

async function call(path, init) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PromptXP ${path} → ${response.status}: ${body.slice(0, 200)}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function errorResult(message) {
  return { content: [{ type: "text", text: `PromptXP error: ${message}` }], isError: true };
}

async function runTool(name, args = {}) {
  switch (name) {
    case "get_engineering_dna": {
      const markdown = await call("/api/dna?format=markdown");
      return textResult(typeof markdown === "string" ? markdown : JSON.stringify(markdown, null, 2));
    }
    case "get_prompt_context": {
      const params = new URLSearchParams({ format: "markdown", limit: String(args.limit ?? 25) });
      if (args.tag) params.set("tag", String(args.tag));
      if (args.query) params.set("q", String(args.query));
      const markdown = await call(`/api/context?${params}`);
      return textResult(typeof markdown === "string" ? markdown : JSON.stringify(markdown, null, 2));
    }
    case "search_prompts": {
      const params = new URLSearchParams({
        limit: String(Math.min(50, Math.max(1, Number(args.limit) || 10))),
        sort: "useful",
      });
      if (args.query) params.set("q", String(args.query));
      if (args.tag) params.set("tag", String(args.tag));
      if (args.kind) params.set("kind", String(args.kind));
      if (args.min_quality) params.set("minQuality", String(args.min_quality));
      const data = await call(`/api/prompts?${params}`);
      const lines = (data.items ?? []).map((item, index) => {
        const meta = [
          item.projectName,
          item.kind,
          `quality ${item.quality}`,
          item.curation?.tags?.length ? `tags: ${item.curation.tags.join(", ")}` : null,
          new Date(item.createdAt).toISOString().slice(0, 10),
          `id: ${item.id}`,
        ]
          .filter(Boolean)
          .join(" · ");
        return `### ${index + 1}. ${meta}\n\n${item.text}`;
      });
      return textResult(
        lines.length
          ? `${lines.length} prompt(s), ${data.total} total matching.\n\n${lines.join("\n\n---\n\n")}`
          : "No prompts matched. Try a broader query, or drop min_quality.",
      );
    }
    case "get_prompt": {
      if (!args.id) return errorResult("id is required");
      if (args.as_template) {
        const data = await call(`/api/prompts/${encodeURIComponent(args.id)}/template`);
        const vars = (data.variables ?? [])
          .map((variable) => `${variable.name} = ${variable.value}`)
          .join("\n");
        return textResult(`${data.text}\n\n---\nVariables:\n${vars || "(none)"}`);
      }
      const data = await call(`/api/prompts/${encodeURIComponent(args.id)}`);
      return textResult(`# ${data.projectName} · ${data.kind} · quality ${data.quality}\n\n${data.text}`);
    }
    case "list_skills": {
      const params = new URLSearchParams();
      if (args.query) params.set("q", String(args.query));
      const data = await call(`/api/skills?${params}`);
      return textResult(
        (data.items ?? [])
          .map(
            (skill) =>
              `- ${skill.name} (${skill.installedIn?.join(", ") ?? skill.sourceLabel}) — ${skill.path}\n  ${skill.description.slice(0, 200)}`,
          )
          .join("\n") || "No skills found.",
      );
    }
    case "list_mcp_servers": {
      const params = new URLSearchParams();
      if (args.query) params.set("q", String(args.query));
      const data = await call(`/api/mcp?${params}`);
      return textResult(
        (data.items ?? [])
          .map(
            (server) =>
              `- ${server.name} [${server.transport}] from ${server.sourceLabel}\n  ${server.snippet.replace(/\n/g, "\n  ")}`,
          )
          .join("\n\n") || "No MCP servers found.",
      );
    }
    default:
      return errorResult(`unknown tool: ${name}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let request;
  try {
    request = JSON.parse(trimmed);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }

  const { id, method, params } = request;
  const isNotification = id === undefined || id === null;

  try {
    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion:
            typeof params?.protocolVersion === "string" ? params.protocolVersion : "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "promptxp", version: VERSION },
          instructions:
            "PromptXP exposes this developer's curated prompts, engineering DNA, skills and MCP servers. Start with get_engineering_dna for a new project.",
        },
      });
      return;
    }
    if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
      return;
    }
    if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      return;
    }
    if (method === "tools/call") {
      const name = params?.name;
      let result;
      try {
        result = await runTool(name, params?.arguments ?? {});
      } catch (error) {
        result = errorResult(
          `${error.message}. Is the PromptXP server running? Start it with: npx promptxp`,
        );
      }
      send({ jsonrpc: "2.0", id, result });
      return;
    }
    if (method === "resources/list") {
      send({ jsonrpc: "2.0", id, result: { resources: [] } });
      return;
    }
    if (method === "prompts/list") {
      send({ jsonrpc: "2.0", id, result: { prompts: [] } });
      return;
    }
    if (isNotification) return;
    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (error) {
    process.stderr.write(`promptxp-mcp: ${error.stack ?? error.message}\n`);
    if (!isNotification) {
      send({ jsonrpc: "2.0", id, error: { code: -32603, message: error.message } });
    }
  }
});

process.stderr.write(`promptxp-mcp ready → ${BASE}\n`);

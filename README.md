# PromptXP

**A local, prompt-native control plane for AI coding agents.**

Prompts are the only durable artifact of an AI session — and the one thing no tool saves
retrievably. PromptXP reads the agent storage already on your Mac, pulls out every prompt you ever
typed, and puts it in one dashboard that you (and your agents) can search, curate and re-use.

```
Library     every prompt from every OpenCode session — cards, compact or full
Skills      every SKILL.md across Claude, Codex, Cursor, OpenCode, deduped by content
MCP         every MCP server across all agent configs, normalised and copy-ready
Sources     exactly what was read, from where, and nothing that was written
```

Everything is local. The server binds to loopback, stores curation in `~/.promptxp`, and never
writes to another agent's storage.

---

## Quickstart

```bash
npm install
npm run dev
# → http://localhost:4310
```

Requires macOS and Node 22+ (uses the built-in `node:sqlite` to read the OpenCode database
read-only). No native modules, no database server, no API keys.

First run scans in a few seconds and caches the index; later boots are instant and a rescan runs in
the background when the index is more than five minutes old.

---

## What it reads

| Source | Prompts | Skills | MCP |
|---|---|---|---|
| **OpenCode** | `~/.local/share/opencode/opencode.db` (read-only SQLite) | `~/.config/opencode/skills`, `~/.opencode/skills` | `opencode.json[c]`, `mcp-servers.json` |
| **Claude Code** | next | `~/.claude/skills`, `~/.agents/skills` | `~/.claude.json`, `settings.json` |
| **Codex** | next | `~/.codex/skills` | `~/.codex/config.toml` |
| **Cursor** | next | `~/.cursor/skills` | `~/.cursor/mcp.json` |
| **Gemini CLI** | next | `~/.gemini/skills` | `~/.gemini/settings.json` |
| **Claude Desktop** | — | — | `claude_desktop_config.json` |

Adding a session store is one adapter file in `lib/adapters` — the prompt schema, curation layer
and API stay identical. See [`spec/PLAN.md`](spec/PLAN.md) for the architecture and roadmap.

### Safety properties

- `opencode.db` is opened with `readOnly: true`. Nothing is ever written back.
- Sessions are never restarted, closed or deleted. Only files are read.
- MCP `env` / `headers` **values** are dropped before serialisation; only key names survive, and
  snippets are emitted with `${PLACEHOLDER}` instead of secrets.
- No telemetry, no outbound requests.

---

## Using it from an agent

This is the point of the product: one URL that gives any agent your standing instructions.

```bash
# a markdown brief of your curated prompt set
curl -s "http://localhost:4310/api/context?format=markdown&limit=25"

# JSON with prompt texts, tags and projects
curl -s "http://localhost:4310/api/context?limit=25"
```

Then, in a new project:

> Read `http://localhost:4310/api/context` and follow my standing rules, stack and style before
> you write anything.

### API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/context?format=markdown&limit=25` | agent-facing digest of curated prompts |
| `GET` | `/api/prompts?q=&starred=1&tag=&project=&source=&sort=&limit=` | library query + facets |
| `GET` | `/api/prompts/:id` | one prompt with curation |
| `PATCH` | `/api/prompts/:id` | `{starred, tags, collectionIds, note, hidden}` |
| `GET` | `/api/skills?q=` | skills with installs across tools |
| `GET` | `/api/mcp?q=` | normalised MCP servers + snippets |
| `GET`/`POST` | `/api/collections` | list / create prompt folders |
| `POST` | `/api/scan` | force a read-only rescan |
| `GET` | `/api/sources` | adapter diagnostics and roots |
| `GET` | `/api/stats` | counts, tags, activity |
| `GET` | `/api/health` | liveness |

---

## Data

| Path | Contents |
|---|---|
| `~/.promptxp/data.json` | stars, tags, collections, notes, hidden prompts |
| `~/.promptxp/cache.json` | last scan snapshot (safe to delete) |

Prompt ids are content-addressed (`source:session:message` hashed), so curation survives rescans
and new sessions.

---

## Scripts

```bash
npm run dev        # local server on :4310
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
```

---

## Status

v0.1 — local web server, OpenCode session adapter, skills + MCP scanners, curation, agent API.
Next: Claude Code / Codex / Cursor session adapters, prompt variables, export to `AGENTS.md`, then
the cloud layer (`promptxp.dev/<you>/<tool>`) for agents that can't see your disk.

The original brief lives in [`spec/prompt/PROMPT.md`](spec/prompt/PROMPT.md); the plan it produced is
[`spec/PLAN.md`](spec/PLAN.md).

# PromptXP

**A local, prompt-native control plane for AI coding agents.**

Prompts are the only durable artifact of an AI session — and the one thing no tool saves
retrievably. PromptXP reads the agent storage already on your Mac, pulls out every prompt you ever
typed, and puts it in one dashboard that you (and your agents) can search, curate and re-use.

```
Library     every reusable prompt from every OpenCode session — cards, compact or full
Skills      every SKILL.md across Claude, Codex, Cursor, OpenCode, deduped by content
MCP         every MCP server across all agent configs, normalised and copy-ready
Sources     exactly what was read, from where, and nothing that was written
```

A **prompt sieve** runs on ingest: continuations, acknowledgements, file stubs and one-liners are
scored and hidden by default (700+ of ~1,900 on the author's machine), while every prompt keeps a
0–100 usefulness score and a kind (`kickoff`, `spec`, `fix`, `question`, `chat`). Nothing is thrown
away — hit **Noise** to see it all.

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

## The MCP bridge

The shortest path from "new project" to "agent already knows my rules": register PromptXP as a local
MCP server once, then any MCP-capable agent can read your vault without you opening a browser.

```json
{
  "mcp": {
    "servers": {
      "promptxp": {
        "type": "local",
        "command": ["node", "/absolute/path/to/promptxp/bin/promptxp-mcp.mjs"]
      }
    }
  }
}
```

Tools it exposes: `get_engineering_dna`, `get_prompt_context`, `search_prompts`, `get_prompt`
(with `as_template: true`), `list_skills`, `list_mcp_servers`. Settings → Agent API renders the exact
snippet with this checkout's path.

> "Call `get_engineering_dna` and `search_prompts(kind='kickoff')`, then build according to those."

## Engineering DNA

`GET /api/dna` aggregates your starred and tagged prompts into your actual defaults: stack signals,
standing rules (lines you wrote with *use / never / always*), and working modes. It is deterministic —
no model call, no summarization, no invention. `/api/dna?format=markdown` is what the agent reads.

## Templates

`GET /api/prompts/:id/template` replaces project-specific nouns, paths, URLs, emails and dates with
`{{project}}`, `{{projectPath}}`, `{{url}}`, `{{email}}`, `{{date}}`, and returns the variable list.
The same view exists in the prompt sheet as **Raw prompt / Reusable template**, so a one-off prompt
becomes the briefing you reuse on the next project.

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
| `GET` | `/api/prompts?q=&starred=1&tag=&project=&source=&kind=&sort=useful&all=1` | library query + facets (`all=1` includes noise) |
| `GET` | `/api/prompts/:id` | one prompt with curation |
| `PATCH` | `/api/prompts/:id` | `{starred, tags, collectionIds, note, hidden}` |
| `GET` | `/api/skills?q=` | skills with installs across tools |
| `GET` | `/api/mcp?q=` | normalised MCP servers + snippets |
| `GET`/`POST` | `/api/collections` | list / create prompt folders |
| `POST` | `/api/scan` | force a read-only rescan |
| `GET` | `/api/sources` | adapter diagnostics and roots |
| `GET` | `/api/dna?format=markdown` | engineering DNA: stack, rules, modes |
| `GET` | `/api/prompts/:id/template` | generalize a prompt into `{{variables}}` |
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

v0.2 — local web server, OpenCode session adapter, prompt sieve + usefulness scoring, skills + MCP
scanners, curation, templates, engineering DNA, local MCP bridge, agent API.
Next: Claude Code / Codex / Cursor session adapters, safe cross-tool config sync with backups, export
to `AGENTS.md`, then the cloud layer (`promptxp.dev/<you>/<tool>`) for agents that can't see your disk.

The original brief lives in [`spec/prompt/PROMPT.md`](spec/prompt/PROMPT.md); the plan it produced is
[`spec/PLAN.md`](spec/PLAN.md).

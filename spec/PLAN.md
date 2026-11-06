# PromptXP — Product Plan

> A local-first, prompt-native control plane for AI coding agents.
> Status: **v0.1 — local web server + dashboard** (macOS). Cloud, desktop, iOS and Android are later phases.

---

## 1. The problem

Every AI coding session starts with writing the same things again.

- A single developer has a limited, personal tech stack, set of preferences, rules and biases. They re-type those rules into every new session.
- Every prompt is *almost* general. It is 80% reusable boilerplate and 20% project-specific intent. There is nowhere to keep the 80%.
- Prompts are the only durable artifact of an AI session, and they are the one thing that is **not** saved anywhere retrievable. Session transcripts bury them: to re-find a good prompt you scroll thousands of lines of tool output.
- Skills live in one tool's folder, MCP servers in another tool's config, and neither is visible from the other.
- Knowledge is trapped per tool. Moving from OpenCode to Claude Code to Cursor to Codex means re-typing configs by hand.

The cost: roughly **one hour of prompt authoring per new project**, repeated hundreds of times, with quality that varies by how much the developer remembers to re-type.

## 2. The product

PromptXP is the **prompt layer** for AI agents. It sits next to every agent, reads what is already on disk, and gives you one place to search, curate, and re-use:

1. **Prompts** — every user prompt that was ever typed into an agent, extracted from the session store, deduplicated, searchable, star-able, taggable, foldered, copy-ready.
2. **Skills** — every `SKILL.md` installed across agent tools, in one searchable catalogue.
3. **MCP** — every MCP server declared in every agent's config, normalized to a single shape, diffable, copyable as a config snippet.
4. **Sessions** — the context behind each prompt (project, title, timestamp, model, agent).

The differentiator is not "a note app for prompts". It is that PromptXP **reads the agents' own storage**, so using it requires zero behaviour change: you keep prompting exactly as you do today and the library fills itself.

### The 5-minute workflow

```
"I'm starting a new project."
  → ask your agent: "read from promptxp what my rules, stack and preferences are"
  → agent hits the local API and gets your curated prompt set
  → 5 minutes instead of 60
```

That is why everything is **API-first and AI-first**: the primary consumer of PromptXP is an agent, not a human. The dashboard exists to curate what the agent reads.

## 3. Principles

| Principle | Consequence |
|---|---|
| **Local first** | The server binds to loopback, stores data in `~/.promptxp`, sends nothing anywhere. Cloud is an opt-in sync target later, not a dependency. |
| **Read-only on agents** | PromptXP never writes to another agent's storage, never restarts or deletes a session. Scanning is strictly read-only. |
| **API-native** | Every screen is a view over the same JSON API that agents use. No feature exists only in the UI. |
| **Prompt-native** | The unit is the prompt, not the conversation. Transcripts are noise; prompts are the asset. |
| **Secrets never leave the machine** | Config values that look like credentials are redacted before they are ever serialized to a response. |
| **Adapters, not integrations** | Each agent tool is one adapter file. Adding Kilo, Kimi, Claude Code or Copilot is a new adapter, not a rewrite. |

## 4. Scope of v0.1 (this repo)

Ship a working local product, not a mock.

**In scope**

- Next.js (App Router) local web server + dashboard, bound to `127.0.0.1`.
- OpenCode adapter: reads `~/.local/share/opencode/opencode.db` (SQLite, both `session_message` and legacy `message`/`part` schemas) **read-only**, plus JSON-file fallback for older installs.
- Skills scanner across `~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`, `~/.config/opencode/skills`, `~/.opencode/skills`, project-local `.claude/skills`.
- MCP scanner across OpenCode (`opencode.json[c]`, `mcp-servers.json`), Claude (`~/.claude.json`, settings), Cursor (`~/.cursor/mcp.json`), Codex (`~/.codex/config.toml`), Gemini, and Claude Desktop. Supports JSON, JSONC and TOML. Normalizes `mcp`, `mcpServers`, `mcp_servers`, `servers` keys.
- Prompt library: three view modes (cards / compact / full), full-text search, filters (starred, tag, project, source, date), sorting, copy, star, tag, collection, hide, notes.
- Curation store at `~/.promptxp/data.json` (atomic writes), scan cache for instant boot + incremental rescans.
- Read-only JSON API for agents: `/api/prompts`, `/api/skills`, `/api/mcp`, `/api/context` (a curated digest an agent can ingest in one request).
- `npx`-able CLI shim (`promptxp`) that starts the server and prints the URL.

**Explicitly out of scope for v0.1**

- Writing to any agent's config or session store (no "apply config" writes yet — copy only).
- Accounts, sync, cloud, teams.
- macOS/iOS/Android native shells, browser extension.
- Non-OpenCode *session* adapters (the adapter interface is in place; those land next).

## 5. Architecture

```
                     ┌───────────────────────────────┐
  Browser (dashboard)│  Next.js App Router (RSC)     │
  Agent (curl/MCP) ──▶│  /api/*  → JSON                │
                     └──────────────┬────────────────┘
                                    │
                     ┌──────────────▼────────────────┐
                     │  Scan service (node runtime)  │
                     │  adapter registry + cache     │
                     └──────────────┬────────────────┘
                                    │ read-only
        ┌───────────────┬───────────┴────────┬─────────────────┐
        ▼               ▼                    ▼                 ▼
  OpenCode SQLite   Skills dirs         MCP configs      Curation store
  (~/.local/share)  (~/.claude, ...)    (opencode,        (~/.promptxp/
                                         claude, cursor,   data.json)
                                         codex, gemini)
```

- **Adapters** (`lib/adapters/*`) expose `id`, `label`, `detect()`, `scanPrompts()`, `scanSkills()`, `scanMcp()`, `roots`.
- **Registry** (`lib/scan.ts`) runs adapters, merges results, applies curation, writes the cache.
- **Curation** never mutates scanned data. Scanned data is a projection of disk; curation is an overlay keyed by `promptId`.
- **Prompt identity** is `source:sessionId:messageId` (stable across rescans) with a content hash for dedupe suggestions.

## 6. Data model

```ts
Prompt {
  id, sourceId, sourceLabel,
  sessionId, sessionTitle, projectPath, projectName,
  text, charCount, wordCount, hash,
  createdAt (ms), agent?, model?,
  attachments: number,
  // overlay
  starred, tags[], collectionIds[], note?, hidden
}

Skill { id, name, description, sourceId, path, bodyPreview, bytes, updatedAt }
McpServer { id, name, sourceId, transport (stdio|http|sse), command?, url?, args?,
            envKeys[], headerKeys[], redacted: boolean, configPath, raw }
SourceStatus { id, label, kind[], available, roots[], counts, lastScanAt, error? }
```

## 7. API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | liveness + version |
| `GET` | `/api/prompts?q=&view=&starred=&tag=&project=&source=&sort=&limit=&offset=` | library query |
| `PATCH` | `/api/prompts/:id` | `{starred?, tags?, collectionIds?, note?, hidden?}` |
| `GET` | `/api/skills?q=` | skill catalogue |
| `GET` | `/api/mcp?q=` | normalized MCP servers |
| `GET` | `/api/collections` / `POST` | prompt folders |
| `POST` | `/api/scan` | `{full?:boolean}` rescan; returns status |
| `GET` | `/api/sources` | adapter diagnostics |
| `GET` | `/api/stats` | counts, top tags, activity |
| `GET` | `/api/context?limit=` | **agent-facing digest**: markdown-ish JSON of the curated prompt set, rules and stack |

`/api/context` is the product's reason to exist: one call gives an agent the developer's standing instructions.

## 7.1 v0.2 — the signal layer

v0.1 proved the extraction. v0.2 answers the two questions that decide whether it is a product:
*is the library readable* and *does an agent actually use it*.

**Prompt sieve** (`lib/sieve.ts`). On ingest every user message is cleaned (agent-injected file stubs
and XML system blocks stripped), scored 0–100 for architectural density (length, bullets, numbered
steps, headings, code fences, stack terms, imperatives, constraints), classified (`kickoff`, `spec`,
`fix`, `question`, `chat`) and flagged `signal`. Continuations, acknowledgements, file stubs and
sub-24-character lines are noise. Noise is hidden by default, never deleted, and always reachable
with the **Noise** toggle.

**Engineering DNA** (`lib/dna.ts`). Aggregates starred/tagged prompts into stack signals, standing
rules (lines containing *use / never / always / must / avoid*), and working modes. Deterministic: no
model call, no invented guidance. Emails and phone numbers are redacted. Served at `/api/dna` and as
the `get_engineering_dna` MCP tool.

**Templates** (`lib/template.ts`). Deterministic de-coupling: project names, paths, URLs, emails and
dates become `{{project}}`, `{{projectPath}}`, `{{url}}`, `{{email}}`, `{{date}}` with a variable
list. Exposed in the prompt sheet as Raw / Template and at `/api/prompts/:id/template`.

**Local MCP bridge** (`bin/promptxp-mcp.mjs`). A stdio MCP server exposing `get_engineering_dna`,
`get_prompt_context`, `search_prompts`, `get_prompt`, `list_skills`, `list_mcp_servers`. This is the
zero-copy-paste path: register once, then a new session starts with "call get_engineering_dna".

**Triage.** Compact view is keyboard-first: `j`/`k` move, `s` star, `c` copy, `o` open.

Deliberately still out of scope: writing into other tools' configs. The matrix, copy snippets and
translation logic can come later, but the read-only contract is worth more than the feature today.

## 8. Roadmap

- **v0.1 (this)** — OpenCode prompts, skills, MCP, curation, API, dashboard.
- **v0.2** — more session adapters (Claude Code JSONL, Codex rollouts, Cursor, Kilo, Kimi), prompt variables/`{{templating}}`, prompt composition, export to `AGENTS.md`.
- **v0.3** — write-side: sync a prompt set into each tool's rules file (opt-in, diff preview, backup).
- **v0.4** — cloud: `promptxp.dev/<username>/<tool>` remote fetch, token auth, encrypted prompt blobs.
- **v0.5** — desktop shell (Tauri), menu-bar capture, iOS/Android readers.

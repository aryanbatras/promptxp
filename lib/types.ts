export type SourceId = "opencode" | "claude" | "codex" | "cursor" | "gemini" | "claude-desktop";

export type PromptKind = "kickoff" | "spec" | "fix" | "question" | "chat";

export interface Prompt {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sessionId: string;
  sessionTitle: string;
  projectPath: string;
  projectName: string;
  text: string;
  charCount: number;
  wordCount: number;
  hash: string;
  createdAt: number;
  quality: number;
  kind: PromptKind;
  signal: boolean;
  agent?: string;
  model?: string;
  attachments: number;
}

export interface Curation {
  starred?: boolean;
  tags?: string[];
  collectionIds?: string[];
  note?: string;
  hidden?: boolean;
  updatedAt?: number;
}

export type CurationMap = Record<string, Curation>;

export interface Collection {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  bodyPreview: string;
  sourceId: string;
  sourceLabel: string;
  path: string;
  root: string;
  scope: "global" | "project";
  files: number;
  bytes: number;
  hash: string;
  updatedAt: number;
}

export type McpTransport = "stdio" | "http" | "sse" | "unknown";

export interface McpServer {
  id: string;
  name: string;
  sourceId: string;
  sourceLabel: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  envKeys: string[];
  headerKeys: string[];
  hadSecrets: boolean;
  configPath: string;
  snippet: string;
  updatedAt: number;
}

export interface SourceStatus {
  id: string;
  label: string;
  kind: Array<"prompts" | "skills" | "mcp">;
  available: boolean;
  roots: string[];
  promptCount: number;
  skillCount: number;
  mcpCount: number;
  error?: string;
}

export interface ScanSnapshot {
  scannedAt: number;
  durationMs: number;
  prompts: Prompt[];
  skills: Skill[];
  mcp: McpServer[];
  sources: SourceStatus[];
}

export interface StoreData {
  version: 1;
  curation: CurationMap;
  collections: Collection[];
  savedSearches: Array<{ id: string; name: string; query: string }>;
}

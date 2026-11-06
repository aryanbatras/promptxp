import type { PromptKind } from "./types";

export interface SieveResult {
  signal: boolean;
  quality: number;
  kind: PromptKind;
  reasons: string[];
}

const NOISE_EXACT =
  /^(?:please\s+)?(?:continue|cont|proceed|next|go\s+on|keep\s+going|carry\s+on|go\s+ahead)(?:\s+(?:and|with|please|building|the\s+plan|implementing))?[\s.!]*$/i;

const ACK_EXACT =
  /^(?:ok|okay|k|yes|yep|no|nope|y|n|done|fixed|sure|thanks|ty|cool|nice|lgtm|perfect|great|good|alright|all\s+right|got\s+it|continue\s+please|please\s+continue)[\s.!,]*$/i;

const STUB_FILE = /^(?:[\w.\- ]+\.(?:json|md|markdown|txt|log|png|jpe?g|gif|pdf|svg))\s*$/i;

const TECH_TERMS = [
  "react", "next.js", "nextjs", "vue", "svelte", "astro", "solid", "angular",
  "tailwind", "shadcn", "css", "html", "typescript", "javascript", "node",
  "python", "java", "kotlin", "flutter", "swift",
  "sql", "postgres", "mysql", "sqlite", "prisma", "drizzle", "migration",
  "api", "rest", "graphql", "trpc", "webhook", "auth", "oauth", "jwt",
  "docker", "kubernetes", "aws", "vercel", "cloudflare", "nginx", "ci",
  "test", "playwright", "vitest", "jest", "lint", "build", "deploy",
  "component", "design", "layout", "responsive", "animation", "typography",
  "schema", "database", "cache", "queue", "cron", "monorepo", "refactor",
  "performance", "accessibility", "seo", "prompt", "agent", "llm", "mcp",
];

const IMPERATIVE =
  /^(?:build|create|implement|refactor|fix|debug|add|remove|delete|design|write|make|use|ensure|update|migrate|review|audit|scan|generate|set\s+up|setup|convert|replace|optimize|test|ship|deploy|document|explain|analy[sz]e|read|plan)\b/i;

const CONSTRAINT = /\b(must|never|always|do\s+not|don't|only|required?|avoid|prefer|should|need\s+to)\b/gi;

/**
 * Removes agent-injected noise from a user message: session-reference file stubs,
 * XML-ish system blocks, and leading/trailing whitespace.
 * The human's actual words are left untouched.
 */
export function cleanPromptText(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  text = text.replace(/<(?:system-reminder|environment_context|user_info)>[\s\S]*?<\/[^>]+>/gi, "");
  // OpenCode prefixes referenced session files as bare filenames on their own lines.
  for (let i = 0; i < 6; i += 1) {
    const next = text.replace(/^\s*(?:[\w./-]+\.(?:json|jsonc|md|markdown|txt|log))\s*\n+/i, "");
    if (next === text) break;
    text = next;
  }
  return text.trim();
}

export function classifyKind(text: string, quality: number): PromptKind {
  const head = text.slice(0, 160);
  const lines = text.split("\n").length;
  if (/^#{1,3}\s|\b(?:spec|requirements?|acceptance criteria)\b/i.test(head) && quality >= 45) {
    return "spec";
  }
  if (
    /^(?:build|create|implement|scaffold|start|design|make|generate|bootstrap|kick\s*off|plan)\b/i.test(
      head,
    ) ||
    /\b(?:from scratch|new project|new website|new app|architecture|tech stack)\b/i.test(head)
  ) {
    return "kickoff";
  }
  if (
    /^(?:fix|debug|why|error|bug|issue|broken|failing|not working|investigate)\b/i.test(head) ||
    /\b(?:stack trace|reproduce|regression|error message)\b/i.test(head)
  ) {
    return "fix";
  }
  if (/\?\s*$/.test(text.trim()) && lines <= 4) return "question";
  return quality >= 40 ? "spec" : "chat";
}

export function sieve(text: string): SieveResult {
  const value = text.trim();
  const reasons: string[] = [];
  const chars = value.length;
  const lower = value.toLowerCase();

  if (!chars) return { signal: false, quality: 0, kind: "chat", reasons: ["empty"] };

  let quality = 0;

  const bullets = (value.match(/^\s*[-*•]\s+\S/gm) ?? []).length;
  const numbered = (value.match(/^\s*\d+[.)]\s+\S/gm) ?? []).length;
  const headings = (value.match(/^#{1,3}\s+\S/gm) ?? []).length;
  const fences = (value.match(/```/g) ?? []).length;

  quality += Math.min(30, Math.round(Math.log2(Math.max(chars, 1) / 60) * 8));
  if (bullets) {
    quality += Math.min(15, bullets * 3);
    reasons.push(`${bullets} bullet points`);
  }
  if (numbered) {
    quality += Math.min(12, numbered * 3);
    reasons.push(`${numbered} numbered steps`);
  }
  if (headings) {
    quality += Math.min(8, headings * 4);
    reasons.push(`${headings} headings`);
  }
  if (fences >= 2) {
    quality += 6;
    reasons.push("code block");
  }

  const techHits = TECH_TERMS.filter((term) => lower.includes(term));
  if (techHits.length) {
    quality += Math.min(18, techHits.length * 3);
    reasons.push(`${techHits.length} stack terms`);
  }

  if (IMPERATIVE.test(value)) {
    quality += 10;
    reasons.push("imperative brief");
  }

  const constraints = (value.match(CONSTRAINT) ?? []).length;
  if (constraints) {
    quality += Math.min(12, constraints * 2);
    reasons.push(`${constraints} constraints`);
  }

  if (chars > 400) quality += 4;
  if (chars > 1500) quality += 4;

  let noise = false;
  if (NOISE_EXACT.test(value) || ACK_EXACT.test(value)) {
    noise = true;
    reasons.push("continuation/acknowledgement");
  }
  if (STUB_FILE.test(value)) {
    noise = true;
    reasons.push("file stub only");
  }
  if (/^[\s\p{P}\p{S}]*$/u.test(value)) {
    noise = true;
    reasons.push("no words");
  }
  if (!noise && /^(?:yes|ok|okay|sure|done)[\s.,!]*(?:please\s+)?(?:continue|proceed)/i.test(value)) {
    noise = true;
    reasons.push("continue-after-ack");
  }
  if (!noise && chars <= 24) {
    noise = true;
    reasons.push("too short to reuse");
  }
  if (!noise && chars < 120) {
    quality -= 22;
    reasons.push("short");
  }

  quality = Math.max(0, Math.min(100, quality));
  const kind = classifyKind(value, quality);
  const signal = !noise && quality >= 22;

  if (!signal && !noise) reasons.push("below signal threshold");

  return { signal, quality, kind, reasons };
}

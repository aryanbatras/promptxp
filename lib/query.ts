import type { CurationMap, Prompt } from "./types";

export type PromptView = "cards" | "compact" | "full";
export type PromptSort = "recent" | "oldest" | "longest" | "shortest" | "az";

export interface PromptWithCuration extends Prompt {
  curation: {
    starred?: boolean;
    tags?: string[];
    collectionIds?: string[];
    note?: string;
    hidden?: boolean;
  };
}

export interface PromptQuery {
  q?: string;
  starred?: boolean;
  tag?: string;
  collection?: string;
  project?: string;
  source?: string;
  sort?: PromptSort;
  limit?: number;
  offset?: number;
  includeHidden?: boolean;
  from?: number;
  to?: number;
}

export function applyQuery(
  prompts: Prompt[],
  curation: CurationMap,
  query: PromptQuery,
): { items: PromptWithCuration[]; total: number; all: PromptWithCuration[] } {
  const needle = query.q?.trim().toLowerCase() ?? "";
  const terms = needle.split(/\s+/).filter(Boolean);

  let all = prompts.map<PromptWithCuration>((prompt) => ({
    ...prompt,
    curation: curation[prompt.id] ?? {},
  }));

  if (!query.includeHidden) all = all.filter((p) => !p.curation.hidden);
  if (query.starred) all = all.filter((p) => p.curation.starred);
  if (query.tag) all = all.filter((p) => p.curation.tags?.includes(query.tag!));
  if (query.collection) {
    all = all.filter((p) => p.curation.collectionIds?.includes(query.collection!));
  }
  if (query.project) all = all.filter((p) => p.projectPath === query.project);
  if (query.source) all = all.filter((p) => p.sourceId === query.source);
  if (query.from) all = all.filter((p) => p.createdAt >= query.from!);
  if (query.to) all = all.filter((p) => p.createdAt <= query.to!);
  if (terms.length) {
    all = all.filter((p) => {
      const haystack = `${p.text}\n${p.projectName}\n${p.projectPath}\n${p.sessionTitle}\n${(p.curation.tags ?? []).join(" ")}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }

  const sort = query.sort ?? "recent";
  all.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "longest":
        return b.charCount - a.charCount;
      case "shortest":
        return a.charCount - b.charCount;
      case "az":
        return a.text.localeCompare(b.text);
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const total = all.length;
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.min(1000, Math.max(1, query.limit ?? 120));
  return { items: all.slice(offset, offset + limit), total, all };
}

export function facets(prompts: PromptWithCuration[]) {
  const tags = new Map<string, number>();
  const projects = new Map<string, { name: string; path: string; count: number }>();
  const sources = new Map<string, number>();
  let starred = 0;
  for (const prompt of prompts) {
    for (const tag of prompt.curation.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    if (prompt.projectPath) {
      const existing = projects.get(prompt.projectPath);
      projects.set(prompt.projectPath, {
        name: prompt.projectName,
        path: prompt.projectPath,
        count: (existing?.count ?? 0) + 1,
      });
    }
    sources.set(prompt.sourceId, (sources.get(prompt.sourceId) ?? 0) + 1);
    if (prompt.curation.starred) starred += 1;
  }
  return {
    tags: Array.from(tags.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    projects: Array.from(projects.values()).sort((a, b) => b.count - a.count),
    sources: Array.from(sources.entries()).map(([sourceId, count]) => ({ sourceId, count })),
    starred,
  };
}

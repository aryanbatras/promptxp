import { json, num } from "@/lib/http";
import { applyQuery } from "@/lib/query";
import { getSnapshot } from "@/lib/scan";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The agent-facing endpoint. One call returns the developer's curated prompt
 * set, formatted so an agent can ingest it as standing instructions.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const limit = num(params.get("limit"), 25) ?? 25;
  const tag = params.get("tag") ?? undefined;
  const q = params.get("q") ?? undefined;
  const starredOnly = params.get("starred") === "1";
  const format = params.get("format") ?? "json";

  const [snapshot, store] = await Promise.all([getSnapshot(), readStore()]);
  const { all } = applyQuery(snapshot.prompts, store.curation, {
    q,
    tag,
    starred: starredOnly,
    sort: "recent",
    limit: 1000,
  });

  const curated = all
    .filter((p) => p.curation.starred || (p.curation.tags?.length ?? 0) > 0)
    .slice(0, limit);
  const selected = curated.length ? curated : all.slice(0, limit);

  const sections = selected.map((prompt) => ({
    id: prompt.id,
    text: prompt.text,
    project: prompt.projectName,
    tags: prompt.curation.tags ?? [],
    note: prompt.curation.note,
    starred: Boolean(prompt.curation.starred),
    createdAt: new Date(prompt.createdAt).toISOString(),
  }));

  const header = [
    `# PromptXP context`,
    ``,
    `Curated standing prompts for this developer, exported ${new Date().toISOString()}.`,
    `${selected.length} prompts · data stays on the local machine.`,
    ``,
    `Treat these as durable preference and style guidance. Project-specific prompts are labelled.`,
  ].join("\n");

  const markdown = [
    header,
    "",
    ...sections.map((section, index) =>
      [
        `## ${index + 1}. ${section.starred ? "★ " : ""}${section.project}${section.tags.length ? ` · ${section.tags.join(", ")}` : ""}`,
        section.note ? `> ${section.note}` : "",
        "",
        section.text,
        "",
      ]
        .filter((line) => line !== "")
        .join("\n"),
    ),
  ].join("\n");

  if (format === "markdown" || format === "md") {
    return new Response(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return json({
    generatedAt: Date.now(),
    promptCount: selected.length,
    collections: store.collections,
    tags: Array.from(new Set(selected.flatMap((p) => p.curation.tags ?? []))),
    prompts: sections,
    markdown,
  });
}

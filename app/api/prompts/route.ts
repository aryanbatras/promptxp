import { bool, fail, json, num } from "@/lib/http";
import { applyQuery, facets, type PromptSort } from "@/lib/query";
import { getSnapshot } from "@/lib/scan";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS: PromptSort[] = ["recent", "oldest", "longest", "shortest", "az", "useful"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  try {
    const [snapshot, store] = await Promise.all([getSnapshot(), readStore()]);
    const sortParam = params.get("sort") as PromptSort | null;
    const query = {
      q: params.get("q") ?? undefined,
      starred: bool(params.get("starred")),
      tag: params.get("tag") ?? undefined,
      collection: params.get("collection") ?? undefined,
      project: params.get("project") ?? undefined,
      source: params.get("source") ?? undefined,
      sort: sortParam && SORTS.includes(sortParam) ? sortParam : "recent",
      limit: num(params.get("limit"), 120),
      offset: num(params.get("offset"), 0),
      includeHidden: bool(params.get("includeHidden")),
      includeNoise: bool(params.get("all")) || params.get("signal") === "0",
      kind: params.get("kind") ?? undefined,
      minQuality: num(params.get("minQuality")),
      from: num(params.get("from")),
      to: num(params.get("to")),
    };
    const { items, total, all } = applyQuery(snapshot.prompts, store.curation, query);
    return json({
      items,
      total,
      noiseTotal: snapshot.prompts.filter((prompt) => !prompt.signal).length,
      scannedAt: snapshot.scannedAt,
      durationMs: snapshot.durationMs,
      facets: facets(all),
      collections: store.collections,
    });
  } catch (error) {
    return fail(`Scan failed: ${(error as Error).message}`, 500);
  }
}

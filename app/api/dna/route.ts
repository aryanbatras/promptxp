import { json, num } from "@/lib/http";
import { buildDna } from "@/lib/dna";
import { getSnapshot } from "@/lib/scan";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The developer's aggregated defaults: stack signals, standing rules and working
 * modes, derived deterministically from starred/tagged prompts. No model call.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const limit = Math.min(500, Math.max(10, num(url.searchParams.get("limit"), 150) ?? 150));

  const [snapshot, store] = await Promise.all([getSnapshot(), readStore()]);
  const dna = buildDna(snapshot.prompts, store.curation, limit);

  if (format === "markdown" || format === "md") {
    return new Response(dna.markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return json(dna);
}

import { json } from "@/lib/http";
import { applyQuery, facets } from "@/lib/query";
import { getSnapshot } from "@/lib/scan";
import { readStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [snapshot, store] = await Promise.all([getSnapshot(), readStore()]);
  const { all } = applyQuery(snapshot.prompts, store.curation, { includeHidden: true, limit: 1 });
  const visible = all.filter((p) => !p.curation.hidden);
  const f = facets(visible);

  const totalChars = visible.reduce((sum, p) => sum + p.charCount, 0);
  const days = new Map<string, number>();
  for (let i = 13; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days.set(date, 0);
  }
  for (const prompt of visible) {
    const key = new Date(prompt.createdAt).toISOString().slice(0, 10);
    if (days.has(key)) days.set(key, (days.get(key) ?? 0) + 1);
  }

  const longest = [...visible].sort((a, b) => b.charCount - a.charCount).slice(0, 5);

  return json({
    counts: {
      prompts: visible.length,
      hidden: all.length - visible.length,
      starred: f.starred,
      tags: f.tags.length,
      projects: f.projects.length,
      skills: snapshot.skills.length,
      mcp: snapshot.mcp.length,
      collections: store.collections.length,
      sessions: new Set(visible.map((p) => p.sessionId)).size,
    },
    totalChars,
    avgChars: visible.length ? Math.round(totalChars / visible.length) : 0,
    topTags: f.tags.slice(0, 8),
    topProjects: f.projects.slice(0, 6),
    activity: Array.from(days.entries()).map(([date, count]) => ({ date, count })),
    longest: longest.map((p) => ({
      id: p.id,
      project: p.projectName,
      chars: p.charCount,
      preview: p.text.slice(0, 120),
    })),
    scannedAt: snapshot.scannedAt,
    durationMs: snapshot.durationMs,
  });
}

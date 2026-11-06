import { json } from "@/lib/http";
import { getSnapshot } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const source = url.searchParams.get("source");
  const snapshot = await getSnapshot();

  const filtered = snapshot.skills.filter((skill) => {
    if (source && skill.sourceId !== source) return false;
    if (!q) return true;
    return `${skill.name}\n${skill.description}\n${skill.bodyPreview}`.toLowerCase().includes(q);
  });

  const installs = new Map<string, { count: number; sources: string[] }>();
  for (const skill of filtered) {
    const entry = installs.get(skill.hash) ?? { count: 0, sources: [] };
    entry.count += 1;
    if (!entry.sources.includes(skill.sourceLabel)) entry.sources.push(skill.sourceLabel);
    installs.set(skill.hash, entry);
  }

  return json({
    items: filtered.map((skill) => ({
      ...skill,
      installs: installs.get(skill.hash)?.count ?? 1,
      installedIn: installs.get(skill.hash)?.sources ?? [skill.sourceLabel],
    })),
    total: filtered.length,
    scannedAt: snapshot.scannedAt,
    sources: Array.from(new Set(snapshot.skills.map((s) => s.sourceId))),
  });
}

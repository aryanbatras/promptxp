import { json } from "@/lib/http";
import { getSnapshot } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const source = url.searchParams.get("source");
  const snapshot = await getSnapshot();

  const items = snapshot.mcp.filter((server) => {
    if (source && server.sourceId !== source) return false;
    if (!q) return true;
    return `${server.name}\n${server.command ?? ""}\n${server.url ?? ""}\n${server.sourceLabel}`
      .toLowerCase()
      .includes(q);
  });

  return json({
    items,
    total: items.length,
    scannedAt: snapshot.scannedAt,
    configFiles: Array.from(new Set(snapshot.mcp.map((s) => s.configPath))),
    sources: Array.from(new Set(snapshot.mcp.map((s) => s.sourceId))),
  });
}

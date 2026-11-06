import { bool, json } from "@/lib/http";
import { getSnapshot, summarise } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  let full = bool(url.searchParams.get("full"));
  if (!full && request.headers.get("content-length")) {
    try {
      const body = (await request.json()) as { full?: boolean };
      full = Boolean(body?.full);
    } catch {
      /* empty body is fine */
    }
  }
  const snapshot = await getSnapshot({ force: true });
  return json({ ...summarise(snapshot), sources: snapshot.sources });
}

export async function GET() {
  const snapshot = await getSnapshot();
  return json({ ...summarise(snapshot), sources: snapshot.sources });
}

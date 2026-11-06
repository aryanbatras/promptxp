import { fail, json } from "@/lib/http";
import { createCollection, listCollections } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ collections: await listCollections() });
}

export async function POST(request: Request) {
  let name = "";
  try {
    const body = (await request.json()) as { name?: string };
    name = (body.name ?? "").trim();
  } catch {
    return fail("Invalid JSON body");
  }
  if (!name) return fail("Collection name is required");
  const collection = await createCollection(name);
  return json({ collection }, { status: 201 });
}

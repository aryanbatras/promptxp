import { fail, json } from "@/lib/http";
import { deleteCollection, listCollections } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const existing = await listCollections();
  if (!existing.some((c) => c.id === id)) return fail("Collection not found", 404);
  await deleteCollection(id);
  return json({ ok: true });
}

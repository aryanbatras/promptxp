import { fail, json } from "@/lib/http";
import { getSnapshot } from "@/lib/scan";
import { patchCuration, readStore } from "@/lib/store";
import type { Curation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const [snapshot, store] = await Promise.all([getSnapshot(), readStore()]);
  const prompt = snapshot.prompts.find((p) => p.id === id);
  if (!prompt) return fail("Prompt not found", 404);
  return json({ ...prompt, curation: store.curation[id] ?? {} });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: Curation;
  try {
    body = (await request.json()) as Curation;
  } catch {
    return fail("Invalid JSON body");
  }

  const snapshot = await getSnapshot();
  if (!snapshot.prompts.some((p) => p.id === id)) return fail("Prompt not found", 404);

  const allowed: Curation = {};
  if (typeof body.starred === "boolean") allowed.starred = body.starred;
  if (typeof body.hidden === "boolean") allowed.hidden = body.hidden;
  if (typeof body.note === "string") allowed.note = body.note.slice(0, 4000);
  if (Array.isArray(body.tags)) allowed.tags = body.tags.slice(0, 40).map(String);
  if (Array.isArray(body.collectionIds)) allowed.collectionIds = body.collectionIds.map(String);

  const curation = await patchCuration(id, allowed);
  return json({ id, curation });
}

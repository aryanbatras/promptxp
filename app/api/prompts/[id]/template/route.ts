import { fail, json } from "@/lib/http";
import { getSnapshot } from "@/lib/scan";
import { toTemplate } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deterministic generalization of one prompt: project nouns → {{variables}}. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const snapshot = await getSnapshot();
  const prompt = snapshot.prompts.find((entry) => entry.id === id);
  if (!prompt) return fail("Prompt not found", 404);

  const projectNames = Array.from(
    new Set(
      snapshot.prompts
        .filter((entry) => entry.projectPath === prompt.projectPath)
        .map((entry) => entry.projectName),
    ),
  );

  return json({ id, original: prompt.text, ...toTemplate(prompt, projectNames) });
}

import { json } from "@/lib/http";
import { SKILL_ROOTS, getSnapshot, summarise } from "@/lib/scan";
import { MCP_CONFIG_TARGETS } from "@/lib/adapters/mcp";
import { HOME, DATA_DIR, CACHE_PATH } from "@/lib/paths";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  return json({
    ...summarise(snapshot),
    home: HOME,
    dataDir: DATA_DIR,
    cachePath: CACHE_PATH,
    sources: snapshot.sources,
    skillRoots: SKILL_ROOTS.map((root) => ({
      ...root,
      root: root.root.startsWith(HOME) ? `~${root.root.slice(HOME.length)}` : root.root,
    })),
    mcpTargets: MCP_CONFIG_TARGETS.map((target) => ({
      ...target,
      path: path.join(HOME, target.rel),
    })),
  });
}

import { json } from "@/lib/http";
import { APP_VERSION, DATA_DIR } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    ok: true,
    app: "promptxp",
    version: APP_VERSION,
    dataDir: DATA_DIR,
    pid: process.pid,
    time: Date.now(),
  });
}

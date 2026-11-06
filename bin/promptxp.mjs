#!/usr/bin/env node
/**
 * PromptXP launcher — starts the local server and prints the URL.
 * Read-only by design: it never touches another agent's storage.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "4310";
const mode = process.argv.includes("--dev") || process.env.NODE_ENV !== "production" ? "dev" : "start";
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

console.log(`\n  PromptXP · local prompt control plane`);
console.log(`  http://localhost:${port}\n`);

const child = spawn(process.execPath, [nextBin, mode, "-p", port, ...(mode === "dev" ? ["-H", "127.0.0.1"] : [])], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env },
});

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 0));

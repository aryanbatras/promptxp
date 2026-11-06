import { createHash } from "node:crypto";

export function hash(value: string, length = 40): string {
  return createHash("sha1").update(value).digest("hex").slice(0, length);
}

export function promptId(sourceId: string, sessionId: string, messageId: string): string {
  return `p_${hash(`${sourceId}:${sessionId}:${messageId}`, 16)}`;
}

export function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

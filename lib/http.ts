import { NextResponse } from "next/server";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, { status });
}

export function num(value: string | null, fallback?: number): number | undefined {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(value: string | null): boolean {
  return value === "1" || value === "true";
}

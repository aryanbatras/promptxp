"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  ArrowUpRight,
  Boxes,
  Command,
  Database,
  LibraryBig,
  Plug,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet, apiSend } from "@/lib/client/api";
import { cn, formatRelative } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

const NAV = [
  { href: "/", label: "Library", icon: LibraryBig, key: "prompts" as const },
  { href: "/skills", label: "Skills", icon: Sparkles, key: "skills" as const },
  { href: "/mcp", label: "MCP", icon: Plug, key: "mcp" as const },
  { href: "/sources", label: "Sources", icon: Database, key: "sources" as const },
  { href: "/settings", label: "Settings", icon: Settings2, key: "settings" as const },
];

interface Summary {
  scannedAt: number;
  durationMs: number;
  counts: {
    prompts: number;
    skills: number;
    mcp: number;
    projects: number;
    sessions: number;
    sources: number;
  };
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [scanning, setScanning] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setSummary(await apiGet<Summary>("/api/scan"));
    } catch {
      /* status is decorative */
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Warm the index in the background when the cache is older than five minutes.
  React.useEffect(() => {
    if (!summary) return;
    if (Date.now() - summary.scannedAt < 5 * 60 * 1000) return;
    const timer = setTimeout(() => {
      void apiSend<Summary>("/api/scan", "POST", { full: true })
        .then(setSummary)
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
  }, [summary]);

  const rescan = async () => {
    setScanning(true);
    try {
      const next = await apiSend<Summary>("/api/scan", "POST", { full: true });
      setSummary(next);
      toast.success(`Rescanned in ${next.durationMs}ms`, {
        description: `${next.counts.prompts} prompts · ${next.counts.skills} skills · ${next.counts.mcp} MCP servers`,
      });
      window.dispatchEvent(new CustomEvent("promptxp:rescan"));
    } catch (error) {
      toast.error("Scan failed", { description: (error as Error).message });
    } finally {
      setScanning(false);
    }
  };

  const counts = summary?.counts;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-border/70 px-4 py-5 md:flex">
        <Link href="/" className="px-1">
          <Logo />
        </Link>

        <nav className="mt-8 flex flex-col gap-0.5">
          <span className="label-mono mb-2 px-2 text-[9px] opacity-70">Workspace</span>
          {NAV.slice(0, 3).map((item) => {
            const active = pathname === item.href;
            const count =
              item.key === "prompts"
                ? counts?.prompts
                : item.key === "skills"
                  ? counts?.skills
                  : item.key === "mcp"
                    ? counts?.mcp
                    : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] transition-colors",
                  active
                    ? "bg-secondary/80 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn("size-4", active ? "text-signal" : "opacity-70")}
                  strokeWidth={1.8}
                />
                <span className="flex-1">{item.label}</span>
                {typeof count === "number" && (
                  <span className="font-mono text-[10px] tabular-nums opacity-50">
                    {count.toLocaleString()}
                  </span>
                )}
              </Link>
            );
          })}

          <span className="label-mono mt-6 mb-2 px-2 text-[9px] opacity-70">System</span>
          {NAV.slice(3).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] transition-colors",
                  active
                    ? "bg-secondary/80 text-foreground"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn("size-4", active ? "text-signal" : "opacity-70")}
                  strokeWidth={1.8}
                />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-lg border border-border/70 bg-card/60 p-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-signal" />
              </span>
              <span className="label-mono text-[9px] text-foreground/80">Local only</span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Reads agent storage on this machine. Nothing is uploaded.
            </p>
            <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2">
              <span className="font-mono text-[10px] text-muted-foreground/70">
                {summary ? formatRelative(summary.scannedAt) : "indexing…"}
              </span>
              <button
                onClick={rescan}
                disabled={scanning}
                className="text-muted-foreground transition-colors hover:text-signal disabled:opacity-50"
                aria-label="Rescan everything"
              >
                <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} />
              </button>
            </div>
          </div>

          <Link
            href="/settings#api"
            className="flex items-center gap-1.5 px-2 font-mono text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <Command className="size-3" />
            agent api
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur-md md:px-8">
          <Link href="/" className="md:hidden">
            <span className="grid size-7 place-items-center rounded-[6px] bg-signal font-semibold text-signal-ink">
              P
            </span>
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <Boxes className="size-3.5 text-muted-foreground/60" strokeWidth={1.8} />
            <span className="font-mono text-[11px] text-muted-foreground">
              {pathname === "/" ? "library" : pathname.replace("/", "")}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground/30">/</span>
            <span className="font-mono text-[11px] text-muted-foreground/60">macos · localhost</span>
          </div>

          <nav className="flex flex-1 items-center gap-1 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded px-2 py-1 font-mono text-[10px] uppercase",
                  pathname === item.href
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {summary && (
              <span className="hidden font-mono text-[10px] text-muted-foreground/60 sm:inline">
                {summary.counts.sources} sources · {summary.counts.sessions.toLocaleString()} sessions
              </span>
            )}
            <Badge variant="outline" className="hidden sm:inline-flex">
              v0.1.0
            </Badge>
            <Button variant="outline" size="sm" onClick={rescan} disabled={scanning}>
              <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} />
              {scanning ? "Scanning" : "Rescan"}
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-6 pb-20 md:px-8">{children}</main>
      </div>
    </div>
  );
}

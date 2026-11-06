"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FolderPlus,
  Loader2,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptCard } from "@/components/prompt-card";
import { PromptDetail } from "@/components/prompt-detail";
import { apiGet, apiSend, copyText } from "@/lib/client/api";
import type { PromptSort, PromptWithCuration } from "@/lib/query";
import type { Collection, Curation } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

type View = "cards" | "compact" | "full";

interface LibraryResponse {
  items: PromptWithCuration[];
  total: number;
  scannedAt: number;
  durationMs: number;
  noiseTotal: number;
  facets: {
    kinds: Array<{ kind: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
    projects: Array<{ name: string; path: string; count: number }>;
    sources: Array<{ sourceId: string; count: number }>;
    starred: number;
  };
  collections: Collection[];
}

const SORTS: Array<{ value: PromptSort; label: string }> = [
  { value: "recent", label: "Newest first" },
  { value: "useful", label: "Most useful" },
  { value: "oldest", label: "Oldest first" },
  { value: "longest", label: "Longest first" },
  { value: "shortest", label: "Shortest first" },
  { value: "az", label: "A → Z" },
];

function FilterMenu({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string | null;
  options: Array<{ value: string; label: string; count?: number }>;
  onSelect: (value: string | null) => void;
}) {
  const active = Boolean(value);
  const activeLabel = options.find((option) => option.value === value)?.label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? "signal" : "outline"}
          size="sm"
          className="gap-1.5 font-normal"
        >
          <span className="font-mono text-[11px] tracking-wide">
            {active ? activeLabel : label}
          </span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {active && (
          <>
            <DropdownMenuItem onSelect={() => onSelect(null)}>
              <X className="size-3.5" /> Clear filter
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.length === 0 && (
          <div className="px-2 py-3 font-mono text-[11px] text-muted-foreground/60">
            nothing here yet
          </div>
        )}
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onSelect(option.value)}>
            <span className="flex-1 truncate">{option.label}</span>
            {typeof option.count === "number" && (
              <span className="font-mono text-[10px] text-muted-foreground/50">{option.count}</span>
            )}
            {value === option.value && <Check className="size-3.5 text-signal" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Library() {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [view, setView] = React.useState<View>("cards");
  const [sort, setSort] = React.useState<PromptSort>("recent");
  const [starred, setStarred] = React.useState(false);
  const [showNoise, setShowNoise] = React.useState(false);
  const [kind, setKind] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const [tag, setTag] = React.useState<string | null>(null);
  const [project, setProject] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<string | null>(null);
  const [collection, setCollection] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(120);
  const [bump, setBump] = React.useState(0);

  const [data, setData] = React.useState<LibraryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<PromptWithCuration | null>(null);

  const [collectionDialog, setCollectionDialog] = React.useState(false);
  const [newCollection, setNewCollection] = React.useState("");
  const [contextCopied, setContextCopied] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const dataRef = React.useRef<LibraryResponse | null>(null);
  dataRef.current = data;

  React.useEffect(() => {
    setLimit(120);
    setCursor(0);
  }, [debounced, sort, starred, tag, project, source, collection, showNoise, kind]);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debounced.trim()) params.set("q", debounced.trim());
    if (starred) params.set("starred", "1");
    if (tag) params.set("tag", tag);
    if (project) params.set("project", project);
    if (source) params.set("source", source);
    if (collection) params.set("collection", collection);
    if (kind) params.set("kind", kind);
    if (showNoise) params.set("all", "1");
    params.set("sort", sort);
    params.set("limit", String(limit));

    setLoading(true);
    apiGet<LibraryResponse>(`/api/prompts?${params.toString()}`, controller.signal)
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debounced, sort, starred, tag, project, source, collection, limit, bump, showNoise, kind]);

  React.useEffect(() => {
    const listener = () => {
      setBump((value) => value + 1);
    };
    window.addEventListener("promptxp:rescan", listener);
    return () => window.removeEventListener("promptxp:rescan", listener);
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing) return;
      if (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const applyPatch = React.useCallback(async (id: string, patch: Curation) => {
    setData((previous) =>
      previous
        ? {
            ...previous,
            items: previous.items.map((prompt) =>
              prompt.id === id
                ? { ...prompt, curation: { ...prompt.curation, ...patch } }
                : prompt,
            ),
            facets:
              typeof patch.starred === "boolean"
                ? {
                    ...previous.facets,
                    starred: previous.facets.starred + (patch.starred ? 1 : -1),
                  }
                : previous.facets,
          }
        : previous,
    );
    setSelected((previous) =>
      previous && previous.id === id
        ? { ...previous, curation: { ...previous.curation, ...patch } }
        : previous,
    );
    try {
      await apiSend(`/api/prompts/${id}`, "PATCH", patch);
      setBump((value) => value + 1);
    } catch (reason) {
      toast.error("Could not save", { description: (reason as Error).message });
    }
  }, []);

  const toggleStar = React.useCallback(
    (prompt: PromptWithCuration) => {
      void applyPatch(prompt.id, { starred: !prompt.curation.starred });
    },
    [applyPatch],
  );

  // Keyboard-first triage in the compact view: j/k move, s star, c copy, o open.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== "compact") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      const items = dataRef.current?.items ?? [];
      if (!items.length) return;
      const current = items[Math.min(cursor, items.length - 1)];
      switch (event.key) {
        case "j":
        case "ArrowDown":
          event.preventDefault();
          setCursor((value) => Math.min(items.length - 1, value + 1));
          break;
        case "k":
        case "ArrowUp":
          event.preventDefault();
          setCursor((value) => Math.max(0, value - 1));
          break;
        case "s":
          event.preventDefault();
          toggleStar(current);
          break;
        case "c":
          event.preventDefault();
          void copyText(current.text).then((ok) => {
            if (ok) toast.success("Prompt copied");
          });
          break;
        case "o":
        case "Enter":
          event.preventDefault();
          setSelected(current);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, cursor, toggleStar]);

  React.useEffect(() => {
    if (view !== "compact") return;
    document
      .querySelector(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cursor, view]);

  const facets = data?.facets;
  const tagSuggestions = React.useMemo(
    () => (facets?.tags ?? []).slice(0, 12).map((entry) => entry.tag),
    [facets],
  );

  const activeFilters = [
    starred ? { key: "starred", label: "★ starred", clear: () => setStarred(false) } : null,
    tag ? { key: "tag", label: `tag: ${tag}`, clear: () => setTag(null) } : null,
    project
      ? {
          key: "project",
          label: `project: ${facets?.projects.find((p) => p.path === project)?.name ?? project}`,
          clear: () => setProject(null),
        }
      : null,
    source ? { key: "source", label: `source: ${source}`, clear: () => setSource(null) } : null,
    collection
      ? {
          key: "collection",
          label: `folder: ${data?.collections.find((c) => c.id === collection)?.name ?? ""}`,
          clear: () => setCollection(null),
        }
      : null,
    kind ? { key: "kind", label: `kind: ${kind}`, clear: () => setKind(null) } : null,
    showNoise ? { key: "noise", label: "noise shown", clear: () => setShowNoise(false) } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  const copyContext = async () => {
    try {
      const response = await fetch("/api/context?format=markdown&limit=25");
      const text = await response.text();
      if (await copyText(text)) {
        setContextCopied(true);
        toast.success("Agent context copied", {
          description: "Your curated prompts as one markdown brief.",
        });
        setTimeout(() => setContextCopied(false), 2000);
      }
    } catch {
      toast.error("Could not build the context digest");
    }
  };

  const createCollection = async () => {
    const name = newCollection.trim();
    if (!name) return;
    try {
      await apiSend("/api/collections", "POST", { name });
      setNewCollection("");
      setCollectionDialog(false);
      setBump((value) => value + 1);
      toast.success(`Collection “${name}” created`);
    } catch (reason) {
      toast.error("Could not create collection", { description: (reason as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-mono flex items-center gap-2">
            <span className="size-1 rounded-full bg-signal" />
            prompt library
            {data && (
              <span className="text-muted-foreground/40">
                · indexed {formatRelative(data.scannedAt)}
              </span>
            )}
          </div>
          <h1 className="display-tight mt-2 text-[42px] md:text-[52px]">
            Every prompt you already wrote.
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] text-muted-foreground">
            Pulled from the sessions on this Mac. Star what works, tag what doesn&apos;t, and let your
            next agent read from here.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCollectionDialog(true)}>
            <FolderPlus className="size-3.5" />
            Collection
          </Button>
          <Button variant="signal" size="sm" onClick={copyContext}>
            {contextCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {contextCopied ? "Copied context" : "Copy agent context"}
          </Button>
        </div>
      </div>

      {data && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground/70">
          <span>
            <span className="text-foreground">{data.total.toLocaleString()}</span> prompts
          </span>
          <span className="text-muted-foreground/25">/</span>
          <span>
            <span className="text-foreground">{facets?.projects.length ?? 0}</span> projects
          </span>
          <span className="text-muted-foreground/25">/</span>
          <span>
            <span className="text-foreground">{facets?.starred ?? 0}</span> starred
          </span>
          <span className="text-muted-foreground/25">/</span>
          <span>
            <span className="text-foreground">{facets?.tags.length ?? 0}</span> tags
          </span>
          <span className="text-muted-foreground/25">/</span>
          <span>
            <span className="text-foreground">{data.collections.length}</span> collections
          </span>
          <span className="text-muted-foreground/25">/</span>
          <span title="continuations, acknowledgements and one-liners are hidden by default">
            <span className="text-foreground">{data.noiseTotal.toLocaleString()}</span> filtered as
            noise
          </span>
          <span className="ml-auto hidden sm:inline">scan {data.durationMs}ms</span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-[420px]">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search every prompt you've written…"
            className="h-9 pr-14 pl-8 text-[13px]"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/60">
            ⌘K
          </kbd>
        </div>

        <Tabs value={view} onValueChange={(value) => setView(value as View)}>
          <TabsList>
            <TabsTrigger value="cards">cards</TabsTrigger>
            <TabsTrigger value="compact">compact</TabsTrigger>
            <TabsTrigger value="full">full</TabsTrigger>
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="size-3.5 opacity-60" />
              <span className="font-mono text-[11px]">{SORTS.find((s) => s.value === sort)?.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort</DropdownMenuLabel>
            {SORTS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={sort === option.value}
                onCheckedChange={() => setSort(option.value)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <FilterMenu
          label="Project"
          value={project}
          onSelect={setProject}
          options={(facets?.projects ?? []).map((entry) => ({
            value: entry.path,
            label: entry.name,
            count: entry.count,
          }))}
        />
        <FilterMenu
          label="Source"
          value={source}
          onSelect={setSource}
          options={(facets?.sources ?? []).map((entry) => ({
            value: entry.sourceId,
            label: entry.sourceId,
            count: entry.count,
          }))}
        />
        <FilterMenu
          label="Folder"
          value={collection}
          onSelect={setCollection}
          options={(data?.collections ?? []).map((entry) => ({
            value: entry.id,
            label: entry.name,
          }))}
        />
        <FilterMenu
          label="Kind"
          value={kind}
          onSelect={setKind}
          options={(facets?.kinds ?? []).map((entry) => ({
            value: entry.kind,
            label: entry.kind,
            count: entry.count,
          }))}
        />
        <Button
          variant={starred ? "signal" : "outline"}
          size="sm"
          onClick={() => setStarred((value) => !value)}
          className="gap-1.5"
        >
          <Star className={cn("size-3.5", starred && "fill-current")} />
          <span className="font-mono text-[11px]">Starred</span>
        </Button>
        <Button
          variant={showNoise ? "signal" : "outline"}
          size="sm"
          onClick={() => setShowNoise((value) => !value)}
          className="gap-1.5"
          title="Show continuations, acknowledgements and one-liners"
        >
          <span className="font-mono text-[11px]">Noise</span>
          <span className="font-mono text-[10px] opacity-60">
            {(data?.noiseTotal ?? 0).toLocaleString()}
          </span>
        </Button>
      </div>

      {view === "compact" && (
        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground/45">
          <span>
            <kbd className="text-foreground/70">j</kbd>/<kbd className="text-foreground/70">k</kbd>{" "}
            move
          </span>
          <span>
            <kbd className="text-foreground/70">s</kbd> star
          </span>
          <span>
            <kbd className="text-foreground/70">c</kbd> copy
          </span>
          <span>
            <kbd className="text-foreground/70">o</kbd> open
          </span>
        </div>
      )}

      {(activeFilters.length > 0 || (facets?.tags.length ?? 0) > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-y border-border/40 py-2">
          <span className="label-mono mr-1 text-[9px]">tags</span>
          {(facets?.tags ?? []).slice(0, 10).map((entry) => (
            <button
              key={entry.tag}
              onClick={() => setTag(tag === entry.tag ? null : entry.tag)}
              className={cn(
                "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                tag === entry.tag
                  ? "border-signal/50 bg-signal/10 text-signal"
                  : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {entry.tag}
              <span className="ml-1 opacity-40">{entry.count}</span>
            </button>
          ))}
          {activeFilters.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={filter.clear}
                  className="flex items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-foreground/80 hover:text-foreground"
                >
                  {filter.label}
                  <X className="size-2.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative mt-4">
        {loading && (
          <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> scanning
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 font-mono text-[12px] text-destructive">
            {error}
          </div>
        )}

        {!data && loading && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[168px] rounded-lg" />
            ))}
          </div>
        )}

        {data && data.items.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-6 py-20 text-center">
            <div className="grid size-10 place-items-center rounded-full border border-border/70 bg-card">
              <Search className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">No prompts match that</p>
            <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
              Try a shorter query, or clear the active filters. The index only contains what is on
              this machine.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setStarred(false);
                setTag(null);
                setProject(null);
                setSource(null);
                setCollection(null);
                setKind(null);
                setShowNoise(false);
              }}
            >
              Clear everything
            </Button>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            {view === "cards" && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    view={view}
                    onOpen={setSelected}
                    onToggleStar={toggleStar}
                    onCopied={() => toast.success("Prompt copied")}
                  />
                ))}
              </div>
            )}
            {view === "compact" && (
              <div className="overflow-hidden rounded-lg border border-border/70 bg-card/40">
                <div className="flex items-center gap-3 border-b border-border/60 px-3 py-2">
                  <span className="label-mono w-[54px] text-[9px]">age</span>
                  <span className="label-mono hidden w-[132px] text-[9px] sm:block">project</span>
                  <span className="label-mono flex-1 text-[9px]">prompt</span>
                  <span className="label-mono w-14 text-right text-[9px]">chars</span>
                  <span className="w-[56px]" />
                </div>
                {data.items.map((prompt, index) => (
                  <div key={prompt.id} data-index={index}>
                    <PromptCard
                      prompt={prompt}
                      view={view}
                      active={index === cursor}
                      onOpen={setSelected}
                      onToggleStar={toggleStar}
                      onCopied={() => toast.success("Prompt copied")}
                    />
                  </div>
                ))}
              </div>
            )}
            {view === "full" && (
              <div className="flex flex-col gap-3">
                {data.items.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    view={view}
                    onOpen={setSelected}
                    onToggleStar={toggleStar}
                    onCopied={() => toast.success("Prompt copied")}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {data && data.total > data.items.length && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLimit((value) => value + 120)}>
              Load {Math.min(120, data.total - data.items.length)} more
            </Button>
            <span className="font-mono text-[10px] text-muted-foreground/50">
              showing {data.items.length.toLocaleString()} of {data.total.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <PromptDetail
        prompt={selected}
        collections={data?.collections ?? []}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onPatch={applyPatch}
        tagSuggestions={tagSuggestions}
      />

      <Dialog open={collectionDialog} onOpenChange={setCollectionDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New collection</DialogTitle>
            <DialogDescription>
              A folder for prompts that belong together — “design rules”, “deploy”, “house style”.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newCollection}
            onChange={(event) => setNewCollection(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createCollection();
            }}
            placeholder="e.g. frontend rules"
          />
          <div className="flex flex-wrap gap-1.5">
            {["house style", "design", "deploy", "debugging", "writing"].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setNewCollection(suggestion)}
                className="rounded-sm border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-signal/50 hover:text-signal"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCollectionDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={createCollection}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

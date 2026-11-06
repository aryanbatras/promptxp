"use client";

import * as React from "react";
import { Check, Copy, EyeOff, FolderPlus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TagInput } from "@/components/tag-input";
import { Textarea } from "@/components/ui/input";
import { apiGet, copyText } from "@/lib/client/api";
import type { PromptWithCuration } from "@/lib/query";
import type { Collection, Curation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

interface PromptDetailProps {
  prompt: PromptWithCuration | null;
  collections: Collection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (id: string, patch: Curation) => void;
  tagSuggestions: string[];
}

function Meta({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-mono text-[9px]">{label}</span>
      <span
        className={cn("truncate text-[12px] text-foreground/85", mono && "font-mono text-[11px]")}
        title={value}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export function PromptDetail({
  prompt,
  collections,
  open,
  onOpenChange,
  onPatch,
  tagSuggestions,
}: PromptDetailProps) {
  const [copied, setCopied] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [mode, setMode] = React.useState<"raw" | "template">("raw");
  const [template, setTemplate] = React.useState<{
    text: string;
    variables: Array<{ name: string; value: string }>;
  } | null>(null);
  const activeId = prompt?.id;

  React.useEffect(() => {
    setNote(prompt?.curation.note ?? "");
  }, [activeId, prompt?.curation.note]);

  React.useEffect(() => {
    setMode("raw");
    setTemplate(null);
  }, [activeId]);

  React.useEffect(() => {
    if (mode !== "template" || !activeId || template) return;
    apiGet<{ text: string; variables: Array<{ name: string; value: string }> }>(
      `/api/prompts/${activeId}/template`,
    )
      .then(setTemplate)
      .catch(() => setTemplate({ text: prompt?.text ?? "", variables: [] }));
  }, [mode, activeId, template, prompt?.text]);

  if (!prompt) return null;
  const tags = prompt.curation.tags ?? [];
  const collectionIds = prompt.curation.collectionIds ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[620px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant="signal">{prompt.sourceLabel}</Badge>
            <Badge variant="outline">{prompt.charCount.toLocaleString()} chars</Badge>
            <Badge variant="outline">quality {prompt.quality}</Badge>
            <Badge variant={prompt.kind === "kickoff" ? "signal" : "muted"}>{prompt.kind}</Badge>
            {prompt.curation.starred && <Badge variant="signal">★ starred</Badge>}
          </div>
          <SheetTitle className="mt-1 text-[15px]">{prompt.sessionTitle}</SheetTitle>
          <SheetDescription className="font-mono text-[11px]">
            {prompt.projectPath || prompt.projectName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={async () => {
                if (await copyText(mode === "template" && template ? template.text : prompt.text)) {
                  setCopied(true);
                  toast.success("Prompt copied", { description: "Paste it into any agent." });
                  setTimeout(() => setCopied(false), 1600);
                } else {
                  toast.error("Could not access the clipboard");
                }
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : mode === "template" ? "Copy template" : "Copy full prompt"}
            </Button>
            <Button
              size="sm"
              variant={prompt.curation.starred ? "signal" : "outline"}
              onClick={() => onPatch(prompt.id, { starred: !prompt.curation.starred })}
            >
              <Star className={cn("size-3.5", prompt.curation.starred && "fill-current")} />
              Star
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onPatch(prompt.id, { hidden: true });
                onOpenChange(false);
                toast("Prompt hidden from the library", {
                  description: "Rescan keeps it out. Clear from Settings.",
                });
              }}
            >
              <EyeOff className="size-3.5" />
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-1 rounded-md bg-secondary/50 p-0.5">
            {(
              [
                { value: "raw" as const, label: "Raw prompt" },
                { value: "template" as const, label: "Reusable template" },
              ]
            ).map((tab) => (
              <button
                key={tab.value}
                onClick={() => setMode(tab.value)}
                className={cn(
                  "flex-1 rounded-[4px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
                  mode === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <pre className="mt-2 max-h-[42vh] overflow-y-auto rounded-lg border border-border/70 bg-background/60 p-4 font-mono text-[12px] leading-[1.7] whitespace-pre-wrap break-words text-foreground/90 select-text">
            {mode === "template" ? (template?.text ?? "building template…") : prompt.text}
          </pre>

          {mode === "template" && template && template.variables.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="label-mono mr-1 text-[9px]">variables</span>
              {template.variables.slice(0, 10).map((variable) => (
                <span
                  key={variable.name + variable.value}
                  title={variable.value}
                  className="rounded-sm border border-signal/25 bg-signal/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-signal/90"
                >
                  {`{{${variable.name}}}`}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
            <Meta label="Captured" value={new Date(prompt.createdAt).toLocaleString()} />
            <Meta label="Agent" value={prompt.agent ?? "—"} />
            <Meta label="Model" value={prompt.model ?? "—"} />
            <Meta label="Session" value={prompt.sessionId} />
            <Meta label="Project" value={prompt.projectName} />
            <Meta label="Attachments" value={String(prompt.attachments)} />
          </div>

          <Separator className="my-6" />

          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="label-mono">Tags</span>
                <span className="font-mono text-[10px] text-muted-foreground/50">
                  {tags.length}/40
                </span>
              </div>
              <TagInput
                value={tags}
                onChange={(next) => onPatch(prompt.id, { tags: next })}
                suggestions={tagSuggestions}
                placeholder="type and press enter…"
              />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="label-mono">Collections</span>
                <span className="font-mono text-[10px] text-muted-foreground/50">
                  {collectionIds.length}
                </span>
              </div>
              {collections.length === 0 ? (
                <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground/60">
                  <FolderPlus className="size-3.5" /> create a collection in the library toolbar
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {collections.map((collection) => {
                    const active = collectionIds.includes(collection.id);
                    return (
                      <button
                        key={collection.id}
                        onClick={() =>
                          onPatch(prompt.id, {
                            collectionIds: active
                              ? collectionIds.filter((id) => id !== collection.id)
                              : [...collectionIds, collection.id],
                          })
                        }
                        className={cn(
                          "rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                          active
                            ? "border-signal/50 bg-signal/10 text-signal"
                            : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
                        )}
                      >
                        {active ? "✓ " : ""}
                        {collection.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <span className="label-mono mb-2 block">Note to future you</span>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onBlur={() => {
                  if (note !== (prompt.curation.note ?? "")) onPatch(prompt.id, { note });
                }}
                placeholder="Why is this prompt good? What do you change per project?"
                className="min-h-[72px] text-[12px]"
              />
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

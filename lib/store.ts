import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, STORE_PATH } from "./paths";
import type { Collection, Curation, StoreData } from "./types";

const EMPTY: StoreData = { version: 1, curation: {}, collections: [], savedSearches: [] };

let writeChain: Promise<unknown> = Promise.resolve();

export async function readStore(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      version: 1,
      curation: parsed.curation ?? {},
      collections: parsed.collections ?? [],
      savedSearches: parsed.savedSearches ?? [],
    };
  } catch {
    return { ...EMPTY, curation: {}, collections: [], savedSearches: [] };
  }
}

async function writeStore(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `.data.${process.pid}.${Date.now()}.json`);
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, STORE_PATH);
}

/** Serialised read-modify-write so concurrent PATCHes never clobber each other. */
export function updateStore<T>(
  mutate: (data: StoreData) => { data: StoreData; result: T },
): Promise<T> {
  const next = writeChain.then(async () => {
    const data = await readStore();
    const { data: updated, result } = mutate(data);
    await writeStore(updated);
    return result;
  });
  writeChain = next.catch(() => undefined);
  return next;
}

export async function patchCuration(id: string, patch: Curation): Promise<Curation> {
  return updateStore((data) => {
    const current = data.curation[id] ?? {};
    const merged: Curation = { ...current, ...patch, updatedAt: Date.now() };
    if (patch.tags) {
      merged.tags = Array.from(
        new Set(patch.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
      ).slice(0, 40);
    }
    if (patch.collectionIds) {
      merged.collectionIds = Array.from(new Set(patch.collectionIds)).slice(0, 20);
    }
    if (merged.note !== undefined && merged.note.trim() === "") delete merged.note;
    if (merged.starred === false) delete merged.starred;
    if (merged.hidden === false) delete merged.hidden;
    // Drop empty overlays so the store stays clean.
    const meaningful =
      merged.starred ||
      merged.hidden ||
      merged.note ||
      (merged.tags && merged.tags.length) ||
      (merged.collectionIds && merged.collectionIds.length);
    if (!meaningful) {
      delete data.curation[id];
      return { data, result: {} };
    }
    data.curation[id] = merged;
    return { data, result: merged };
  });
}

export async function listCollections(): Promise<Collection[]> {
  return (await readStore()).collections;
}

export async function createCollection(name: string, color?: string): Promise<Collection> {
  return updateStore((data) => {
    const collection: Collection = {
      id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim().slice(0, 60) || "Untitled",
      color,
      createdAt: Date.now(),
    };
    data.collections = [...data.collections, collection];
    return { data, result: collection };
  });
}

export async function deleteCollection(id: string): Promise<void> {
  await updateStore((data) => {
    data.collections = data.collections.filter((c) => c.id !== id);
    for (const [promptId, curation] of Object.entries(data.curation)) {
      if (curation.collectionIds?.includes(id)) {
        const remaining = curation.collectionIds.filter((c) => c !== id);
        if (remaining.length) data.curation[promptId] = { ...curation, collectionIds: remaining };
        else delete data.curation[promptId].collectionIds;
      }
    }
    return { data, result: undefined };
  });
}

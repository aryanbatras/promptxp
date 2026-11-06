import os from "node:os";
import path from "node:path";

export const HOME = process.env.PROMPTXP_HOME || os.homedir();

export const DATA_DIR =
  process.env.PROMPTXP_DATA_DIR || path.join(HOME, ".promptxp");

export const STORE_PATH = path.join(DATA_DIR, "data.json");
export const CACHE_PATH = path.join(DATA_DIR, "cache.json");

export const APP_VERSION = "0.2.0";

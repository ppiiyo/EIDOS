import fs from 'node:fs';
import path from 'node:path';

/**
 * Lightweight atomic JSON store for operational control-plane state
 * (API keys, merchandising rules, synonyms, blacklist, telemetry aggregates).
 * Replaces volatile Map-only state without requiring native C++ addons.
 */
export class PersistenceStore {
  private readonly dir: string;
  private readonly diskEnabled: boolean;

  constructor(baseDir?: string) {
    const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    this.diskEnabled = Boolean(baseDir || process.env.EIDOS_DATA_DIR) || !isTestEnv;
    this.dir = path.resolve(baseDir || process.env.EIDOS_DATA_DIR || './data/db');
    if (this.diskEnabled && !fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private filePath(namespace: string): string {
    const safe = namespace.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dir, `${safe}.json`);
  }

  public read<T>(namespace: string, fallback: T): T {
    if (!this.diskEnabled) return fallback;
    const file = this.filePath(namespace);
    if (!fs.existsSync(file)) return fallback;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[PersistenceStore] Failed to read ${file}, using fallback:`, err);
      return fallback;
    }
  }

  public write<T>(namespace: string, data: T): void {
    if (!this.diskEnabled) return;
    const file = this.filePath(namespace);
    const tmp = `${file}.${process.pid}.tmp`;
    try {
      if (!fs.existsSync(this.dir)) {
        fs.mkdirSync(this.dir, { recursive: true });
      }
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error(`[PersistenceStore] Failed to write ${file}:`, err);
      if (fs.existsSync(tmp)) {
        try { fs.unlinkSync(tmp); } catch {}
      }
    }
  }
}

let defaultStore: PersistenceStore | null = null;
export function getPersistenceStore(): PersistenceStore {
  if (!defaultStore) {
    defaultStore = new PersistenceStore();
  }
  return defaultStore;
}

export function resetPersistenceStoreForTests(customDir?: string): PersistenceStore {
  defaultStore = new PersistenceStore(customDir);
  return defaultStore;
}

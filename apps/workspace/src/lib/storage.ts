import { createStore, get, set, del, clear, UseStore } from "idb-keyval";
import { HNSWIndex, HNSWIndexSerializer } from '@eidos/core';
import { Project, Concept } from '../types';
import { PRESET_DOMAINS } from '../data/presets';

const IDB_DB_NAME = 'eidos_browser_db_v2';
const IDB_STORE_NAME = 'eidos_kv_store';

const KEY_PROJECTS = 'eidos_projects_v2';
const KEY_ACTIVE_PROJECT = 'eidos_active_project_v2';
const KEY_BINARY_EMBEDDINGS = 'eidos_binary_embeddings_v2';
const KEY_HNSW_BINARY = 'eidos_hnsw_binary_v2';

let customStore: UseStore | null = null;
let forceQuotaExceededForTests = false;

export class StorageQuotaError extends Error {
  public readonly estimatedBytes: number;

  constructor(message: string, estimatedBytes = 0) {
    super(message);
    this.name = 'StorageQuotaError';
    this.estimatedBytes = estimatedBytes;
  }
}

export function simulateQuotaExceededForTests(enabled: boolean): void {
  forceQuotaExceededForTests = enabled;
}

export function getEidosIdbStore(): UseStore {
  if (!customStore) {
    customStore = createStore(IDB_DB_NAME, IDB_STORE_NAME);
  }
  return customStore;
}

async function safeIdbSet<T>(key: string, value: T, estimatedBytes = 0): Promise<void> {
  if (forceQuotaExceededForTests) {
    throw new StorageQuotaError(
      `IndexedDB quota exceeded while writing key "${key}" (~${estimatedBytes} bytes)`,
      estimatedBytes
    );
  }
  try {
    await set(key, value, getEidosIdbStore());
  } catch (err: unknown) {
    const isQuota =
      err instanceof Error &&
      (err.name === 'QuotaExceededError' ||
        err.message.toLowerCase().includes('quota'));
    if (isQuota) {
      throw new StorageQuotaError(
        `IndexedDB storage quota exceeded while saving "${key}": ${err.message}`,
        estimatedBytes
      );
    }
    throw err;
  }
}

export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export function createDefaultProject(): Project {
  const defaultDomain = PRESET_DOMAINS.catalog;
  const concepts: Concept[] = defaultDomain.concepts.map((name, idx) => ({
    id: `c_init_${idx}`,
    name,
    category: 'Каталог Eidos',
  }));

  return {
    id: 'proj_default_catalog',
    name: defaultDomain.name,
    description: defaultDomain.description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    concepts,
    threshold: 0.35,
  };
}

// Synchronous in-memory mirror backed asynchronously by IndexedDB
let memoryProjects: Project[] = [createDefaultProject()];
let memoryActiveProjectId: string = memoryProjects[0].id;

export async function saveProjectsToIdb(projects: Project[]): Promise<void> {
  memoryProjects = projects;
  await safeIdbSet(KEY_PROJECTS, projects);
}

export async function loadProjectsFromIdb(): Promise<Project[]> {
  try {
    const stored = await get<Project[]>(KEY_PROJECTS, getEidosIdbStore());
    if (Array.isArray(stored) && stored.length > 0) {
      memoryProjects = stored;
      return stored;
    }
  } catch {
    // Fallback to in-memory default if IndexedDB is unavailable in restricted iframe
  }
  const def = createDefaultProject();
  memoryProjects = [def];
  await safeIdbSet(KEY_PROJECTS, memoryProjects).catch(() => {});
  return memoryProjects;
}

export function loadProjects(): Project[] {
  return memoryProjects;
}

export function saveProjects(projects: Project[]): void {
  memoryProjects = projects;
  void safeIdbSet(KEY_PROJECTS, projects).catch(() => {});
}

export function getActiveProjectId(): string | null {
  return memoryActiveProjectId;
}

export function setActiveProjectId(id: string): void {
  memoryActiveProjectId = id;
  void safeIdbSet(KEY_ACTIVE_PROJECT, id).catch(() => {});
}

export async function loadActiveProjectIdFromIdb(): Promise<string> {
  try {
    const id = await get<string>(KEY_ACTIVE_PROJECT, getEidosIdbStore());
    if (id) {
      memoryActiveProjectId = id;
      return id;
    }
  } catch {
    // ignore
  }
  return memoryActiveProjectId;
}

/**
 * Persists a Map<string, Float32Array> directly into IndexedDB using native Structured Clone
 * of binary Float32Array buffers (zero JSON float-to-string inflation).
 */
export async function saveBinaryEmbeddingsToIdb(
  embeddings: Map<string, Float32Array>
): Promise<void> {
  const entries: Array<[string, Float32Array]> = [];
  let bytes = 0;
  for (const [id, vec] of embeddings.entries()) {
    const f32 = vec instanceof Float32Array ? vec : new Float32Array(vec);
    entries.push([String(id), f32]);
    bytes += f32.byteLength + id.length * 2;
  }
  await safeIdbSet(KEY_BINARY_EMBEDDINGS, entries, bytes);
}

/**
 * Loads binary Float32Array embeddings from IndexedDB.
 */
export async function loadBinaryEmbeddingsFromIdb(): Promise<Map<string, Float32Array>> {
  const map = new Map<string, Float32Array>();
  const stored = await get<Array<[string, Float32Array | ArrayBuffer | number[]]>>(
    KEY_BINARY_EMBEDDINGS,
    getEidosIdbStore()
  );
  if (!Array.isArray(stored)) {
    return map;
  }
  for (const [id, raw] of stored) {
    if (raw instanceof Float32Array) {
      map.set(String(id), raw);
    } else if (raw instanceof ArrayBuffer) {
      map.set(String(id), new Float32Array(raw));
    } else if (Array.isArray(raw)) {
      map.set(String(id), new Float32Array(raw));
    } else if (raw && typeof (raw as { buffer?: ArrayBuffer }).buffer !== 'undefined') {
      const view = raw as ArrayBufferView;
      map.set(
        String(id),
        new Float32Array(view.buffer, view.byteOffset, view.byteLength / 4)
      );
    }
  }
  return map;
}

/**
 * Serializes an HNSWIndex into a compact binary Uint8Array and saves it in IndexedDB.
 */
export async function saveHnswIndexToIdb(index: HNSWIndex): Promise<void> {
  const binary = HNSWIndexSerializer.serialize(index);
  await safeIdbSet(KEY_HNSW_BINARY, binary, binary.byteLength);
}

/**
 * Restores an HNSWIndex from IndexedDB binary storage.
 */
export async function loadHnswIndexFromIdb(): Promise<HNSWIndex | null> {
  const stored = await get<Uint8Array>(KEY_HNSW_BINARY, getEidosIdbStore());
  if (!stored) return null;
  const bytes =
    stored instanceof Uint8Array
      ? stored
      : new Uint8Array(
          (stored as ArrayBufferView).buffer ?? (stored as unknown as ArrayBuffer)
        );
  if (bytes.byteLength < 24) return null;
  return HNSWIndexSerializer.deserialize(bytes);
}

export async function clearAllIdbStorage(): Promise<void> {
  await del(KEY_PROJECTS, getEidosIdbStore()).catch(() => {});
  await del(KEY_ACTIVE_PROJECT, getEidosIdbStore()).catch(() => {});
  await del(KEY_BINARY_EMBEDDINGS, getEidosIdbStore()).catch(() => {});
  await del(KEY_HNSW_BINARY, getEidosIdbStore()).catch(() => {});
  await clear(getEidosIdbStore()).catch(() => {});
}

export function exportProjectJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function parseImportedProject(jsonString: string): Project {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.concepts)) {
    throw new Error('Некорректный формат файла проекта Eidos');
  }

  return {
    id: generateId(),
    name: `${parsed.name} (Импорт)`,
    description: parsed.description || 'Импортированный семантический проект',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    threshold: typeof parsed.threshold === 'number' ? parsed.threshold : 0.35,
    concepts: parsed.concepts.map((c: { name?: unknown; category?: string; notes?: string }, i: number) => ({
      id: `c_imp_${Date.now()}_${i}`,
      name: String(c.name || c).trim(),
      category: c.category || 'Импорт',
      notes: c.notes || '',
      createdAt: Date.now(),
    })),
  };
}

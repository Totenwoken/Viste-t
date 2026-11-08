import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { apiFetch, BudgetExceededError, UnauthorizedError } from "./api";
import { ImageDecodeError, prepareGarmentImage, uploadToSignedUrl } from "./image";

export type QueueItemStatus = "queued" | "created" | "uploaded" | "done" | "error";

export interface QueueItem {
  id: string;
  status: QueueItemStatus;
  garmentId?: string;
  /** La foto guardada ya está comprimida y sin fondo. */
  prepared?: boolean;
  error?: string;
  /** Estado desde el que se reintenta si está en error. */
  failedAt?: Exclude<QueueItemStatus, "done" | "error">;
}

export type QueueState = "idle" | "running" | "paused_budget" | "paused_auth" | "paused_offline";

/** Error de red de fetch (sin conexión): Chrome "Failed to fetch", Safari "Load failed", Firefox "NetworkError…". */
export function isOfflineError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return e instanceof TypeError && /fetch|load failed|network/i.test(e.message);
}

export interface QueueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export interface QueueDeps {
  prepare(b: Blob): Promise<Blob>;
  create(): Promise<{ garmentId: string; uploadUrl: string }>;
  upload(url: string, b: Blob): Promise<void>;
  tag(garmentId: string): Promise<void>;
  renewUploadUrl(garmentId: string): Promise<string>;
  /** Borra la prenda pendiente creada para un elemento que se descarta. */
  discardGarment(garmentId: string): Promise<void>;
  store: QueueStore;
}

/** Paso en el que está un elemento (processItem lo avanza paso a paso), para mensajes de error. */
function stageLabel(item: QueueItem): string {
  if (item.status === "queued") return item.prepared ? "Al crear la prenda" : "Al preparar la foto";
  if (item.status === "created") return "Al subir la foto";
  return "Al analizar la prenda";
}

function errorDetail(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.slice(0, 160) || "error desconocido";
}

const QUEUE_KEY = "vistet.queue";
const blobKey = (id: string) => `vistet.blob.${id}`;

export function createUploadQueue(deps: QueueDeps) {
  let items: QueueItem[] = [];
  let state: QueueState = "idle";
  let loaded = false;
  let running: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((fn) => fn());
  const persist = async () => {
    await deps.store.set(QUEUE_KEY, items);
    notify();
  };
  const update = async (item: QueueItem, patch: Partial<QueueItem>) => {
    Object.assign(item, patch);
    items = [...items];
    await persist();
  };
  const load = async () => {
    if (loaded) return;
    const saved = (await deps.store.get(QUEUE_KEY)) as QueueItem[] | undefined;
    items = Array.isArray(saved) ? saved.map((i) => ({ ...i })) : [];
    loaded = true;
  };

  async function processItem(item: QueueItem): Promise<void> {
    let uploadUrl: string | undefined;
    if (item.status === "queued") {
      if (!item.prepared) {
        const original = (await deps.store.get(blobKey(item.id))) as Blob | undefined;
        if (!original) throw new ImageDecodeError();
        await deps.store.set(blobKey(item.id), await deps.prepare(original));
        await update(item, { prepared: true });
      }
      const created = await deps.create();
      uploadUrl = created.uploadUrl;
      await update(item, { status: "created", garmentId: created.garmentId });
    }
    if (item.status === "created") {
      const blob = (await deps.store.get(blobKey(item.id))) as Blob | undefined;
      if (!blob) throw new ImageDecodeError();
      await deps.upload(uploadUrl ?? (await deps.renewUploadUrl(item.garmentId!)), blob);
      await update(item, { status: "uploaded" });
    }
    if (item.status === "uploaded") {
      await deps.tag(item.garmentId!);
      await deps.store.del(blobKey(item.id));
      await update(item, { status: "done" });
    }
  }

  async function runLoop() {
    state = "running";
    notify();
    for (;;) {
      const next = items.find((i) => i.status !== "done" && i.status !== "error");
      if (!next) break;
      try {
        await processItem(next);
      } catch (e) {
        if (e instanceof BudgetExceededError) {
          state = "paused_budget";
          notify();
          return;
        }
        if (e instanceof UnauthorizedError) {
          state = "paused_auth";
          notify();
          return;
        }
        if (isOfflineError(e)) {
          // Sin conexión: el elemento se queda en su etapa y se sigue al volver la conexión.
          state = "paused_offline";
          notify();
          return;
        }
        const message = e instanceof ImageDecodeError ? e.message : `${stageLabel(next)}: ${errorDetail(e)}`;
        // next.status es la etapa en la que falló (processItem la avanza paso a paso).
        await update(next, { status: "error", error: message, failedAt: next.status as NonNullable<QueueItem["failedAt"]> });
      }
    }
    state = "idle";
    notify();
  }

  function run(): Promise<void> {
    if (!running) running = runLoop().finally(() => (running = null));
    return running;
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      if (state === "paused_offline") void run();
    });
  }

  return {
    async add(files: Blob[]): Promise<void> {
      await load();
      for (const f of files) {
        const id = crypto.randomUUID();
        await deps.store.set(blobKey(id), f);
        items = [...items, { id, status: "queued" }];
      }
      await persist();
      // Si la cola ya está en marcha, el bucle recoge los nuevos elementos.
      await run();
    },
    async resume(): Promise<void> {
      await load();
      notify();
      await run();
    },
    items: (): QueueItem[] => items,
    state: (): QueueState => state,
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async retry(id: string): Promise<void> {
      await load();
      const item = items.find((i) => i.id === id);
      if (!item || item.status !== "error") return;
      await update(item, { status: item.failedAt ?? "queued", error: undefined, failedAt: undefined });
      await run();
    },
    async retryAll(): Promise<void> {
      await load();
      items = items.map((i) =>
        i.status === "error" ? { ...i, status: i.failedAt ?? "queued", error: undefined, failedAt: undefined } : i,
      );
      await persist();
      await run();
    },
    async discard(id: string): Promise<void> {
      await load();
      const item = items.find((i) => i.id === id);
      if (!item || item.status !== "error") return;
      await deps.store.del(blobKey(id));
      items = items.filter((i) => i.id !== id);
      await persist();
      if (item.garmentId) await deps.discardGarment(item.garmentId).catch(() => {});
    },
    async clearDone(): Promise<void> {
      await load();
      items = items.filter((i) => i.status !== "done");
      await persist();
    },
  };
}

export type UploadQueue = ReturnType<typeof createUploadQueue>;

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
  return (await res.json()) as T;
}

export function defaultQueueDeps(): QueueDeps {
  const post = (path: string, body?: unknown) =>
    apiFetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    prepare: prepareGarmentImage,
    create: async () => readJson(await post("/api/garments/create")),
    upload: uploadToSignedUrl,
    discardGarment: async (garmentId) => {
      await apiFetch(`/api/garments?id=${encodeURIComponent(garmentId)}`, { method: "DELETE" });
    },
    tag: async (garmentId) => {
      await readJson(await post("/api/garments/tag", { garmentId }));
    },
    renewUploadUrl: async (garmentId) =>
      (await readJson<{ uploadUrl: string }>(await post("/api/garments/upload-url", { garmentId }))).uploadUrl,
    store: { get: (k) => idbGet(k), set: (k, v) => idbSet(k, v), del: (k) => idbDel(k) },
  };
}

let shared: UploadQueue | null = null;
/** Cola única de la app. */
export function getUploadQueue(): UploadQueue {
  if (!shared) shared = createUploadQueue(defaultQueueDeps());
  return shared;
}

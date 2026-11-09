/**
 * Quitar el fondo en un Web Worker, fuera del hilo de la pantalla: la app sigue respondiendo mientras procesa.
 * Si el worker falla, se cae (p. ej. por memoria en el iPhone) o tarda demasiado, se devuelve la foto original
 * para que la cola de subida nunca se atasque.
 */
export interface BgWorkerLike {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  postMessage(msg: { id: number; blob: Blob }): void;
  terminate(): void;
}

export const BG_TIMEOUT_MS = 90_000;

export function createBackgroundRemover(makeWorker: () => BgWorkerLike, timeoutMs = BG_TIMEOUT_MS) {
  let worker: BgWorkerLike | null = null;
  let nextId = 0;
  const pending = new Map<number, (b: Blob | null) => void>();

  const reset = () => {
    worker?.terminate();
    worker = null;
    for (const resolve of pending.values()) resolve(null);
    pending.clear();
  };

  const getWorker = (): BgWorkerLike => {
    if (worker) return worker;
    const w = makeWorker();
    w.onmessage = (e: MessageEvent) => {
      const { id, blob } = e.data as { id: number; blob?: Blob; error?: string };
      const resolve = pending.get(id);
      pending.delete(id);
      resolve?.(blob ?? null);
    };
    w.onerror = () => reset();
    worker = w;
    return w;
  };

  return async function removeBackground(img: Blob): Promise<Blob> {
    let w: BgWorkerLike;
    try {
      w = getWorker();
    } catch {
      return img;
    }
    const id = ++nextId;
    const result = await new Promise<Blob | null>((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(null);
        reset(); // un worker colgado se descarta; el siguiente empieza limpio
      }, timeoutMs);
      pending.set(id, (b) => {
        clearTimeout(timer);
        resolve(b);
      });
      w.postMessage({ id, blob: img });
    });
    return result ?? img;
  };
}

import { createBackgroundRemover, type BgWorkerLike } from "./bgRemover";

class FakeWorker implements BgWorkerLike {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  posted: { id: number; blob: Blob }[] = [];
  terminated = false;
  postMessage(msg: { id: number; blob: Blob }) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  reply(id: number, data: { blob?: Blob; error?: string }) {
    this.onmessage?.({ data: { id, ...data } } as MessageEvent);
  }
}

const photo = new Blob(["foto"], { type: "image/jpeg" });
const cutout = new Blob(["sin fondo"], { type: "image/webp" });

test("envía la foto al worker y devuelve la imagen sin fondo", async () => {
  const w = new FakeWorker();
  const remove = createBackgroundRemover(() => w, 1000);
  const p = remove(photo);
  expect(w.posted[0].blob).toBe(photo);
  w.reply(w.posted[0].id, { blob: cutout });
  await expect(p).resolves.toBe(cutout);
});

test("si el worker devuelve un error, se usa la foto original (la cola no se atasca)", async () => {
  const w = new FakeWorker();
  const remove = createBackgroundRemover(() => w, 1000);
  const p = remove(photo);
  w.reply(w.posted[0].id, { error: "sin memoria" });
  await expect(p).resolves.toBe(photo);
});

test("si tarda más del límite, se usa la foto original y se reinicia el worker", async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  const remove = createBackgroundRemover(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  }, 1000);
  const p = remove(photo);
  vi.advanceTimersByTime(1001);
  await expect(p).resolves.toBe(photo);
  expect(workers[0].terminated).toBe(true);
  remove(photo);
  expect(workers).toHaveLength(2);
  vi.useRealTimers();
});

test("si el worker se cae (onerror), se usa la foto original y el siguiente usa un worker nuevo", async () => {
  const workers: FakeWorker[] = [];
  const remove = createBackgroundRemover(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  }, 1000);
  const p = remove(photo);
  workers[0].onerror?.({ message: "crash" } as ErrorEvent);
  await expect(p).resolves.toBe(photo);
  remove(photo);
  expect(workers).toHaveLength(2);
});

test("si no se puede crear el worker, se usa la foto original", async () => {
  const remove = createBackgroundRemover(() => {
    throw new Error("Worker no soportado");
  }, 1000);
  await expect(remove(photo)).resolves.toBe(photo);
});

test("reutiliza el mismo worker para varias fotos", async () => {
  const workers: FakeWorker[] = [];
  const remove = createBackgroundRemover(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  }, 1000);
  const a = remove(photo);
  workers[0].reply(workers[0].posted[0].id, { blob: cutout });
  await a;
  const b = remove(photo);
  workers[0].reply(workers[0].posted[1].id, { blob: cutout });
  await b;
  expect(workers).toHaveLength(1);
});

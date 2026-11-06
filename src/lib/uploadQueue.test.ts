import { createUploadQueue, type QueueDeps, type QueueItem } from "./uploadQueue";
import { BudgetExceededError, UnauthorizedError } from "./api";
import { ImageDecodeError } from "./image";

vi.mock("@imgly/background-removal", () => ({ removeBackground: vi.fn() }));

function memoryStore(initial: Record<string, unknown> = {}) {
  const m = new Map<string, unknown>(Object.entries(initial));
  return {
    map: m,
    get: async (k: string) => m.get(k),
    set: async (k: string, v: unknown) => void m.set(k, v),
    del: async (k: string) => void m.delete(k),
  };
}

function fakeDeps(over: Partial<QueueDeps> = {}, store = memoryStore()) {
  let n = 0;
  const deps = {
    prepare: vi.fn(async (b: Blob) => new Blob([b], { type: "image/webp" })),
    create: vi.fn(async () => ({ garmentId: `g${++n}`, uploadUrl: `https://up/${n}` })),
    upload: vi.fn(async (_u: string, _b: Blob) => {}),
    tag: vi.fn(async (_id: string) => {}),
    renewUploadUrl: vi.fn(async (id: string) => `https://renew/${id}`),
    store,
    ...over,
  };
  return deps;
}

const photo = (s: string) => new Blob([s], { type: "image/jpeg" });
const statuses = (items: QueueItem[]) => items.map((i) => i.status);

test("procesa 3 fotos en orden y termina con 3 done", async () => {
  const deps = fakeDeps();
  const q = createUploadQueue(deps);
  await q.add([photo("a"), photo("b"), photo("c")]);
  expect(statuses(q.items())).toEqual(["done", "done", "done"]);
  expect(vi.mocked(deps.tag).mock.calls.map((c) => c[0])).toEqual(["g1", "g2", "g3"]);
  expect(q.state()).toBe("idle");
});

test("reanudar tras 'cerrar' en created: no vuelve a llamar a create, sí a upload y tag", async () => {
  const store = memoryStore({
    "vistet.queue": [{ id: "q1", status: "created", garmentId: "g9" }],
    "vistet.blob.q1": photo("prep"),
  });
  const deps = fakeDeps({}, store);
  const q = createUploadQueue(deps);
  await q.resume();
  expect(deps.create).not.toHaveBeenCalled();
  expect(deps.prepare).not.toHaveBeenCalled();
  expect(deps.upload).toHaveBeenCalledWith("https://renew/g9", expect.any(Blob));
  expect(deps.tag).toHaveBeenCalledWith("g9");
  expect(statuses(q.items())).toEqual(["done"]);
});

test("reanudar un elemento uploaded solo llama a tag", async () => {
  const store = memoryStore({ "vistet.queue": [{ id: "q1", status: "uploaded", garmentId: "g9" }] });
  const deps = fakeDeps({}, store);
  const q = createUploadQueue(deps);
  await q.resume();
  expect(deps.upload).not.toHaveBeenCalled();
  expect(deps.tag).toHaveBeenCalledWith("g9");
});

test("el garmentId se guarda antes de subir", async () => {
  const store = memoryStore();
  const deps = fakeDeps(
    {
      upload: vi.fn(async () => {
        const saved = store.map.get("vistet.queue") as QueueItem[];
        expect(saved[0]).toMatchObject({ status: "created", garmentId: "g1" });
      }),
    },
    store,
  );
  await createUploadQueue(deps).add([photo("a")]);
  expect(deps.upload).toHaveBeenCalledTimes(1);
});

test("ImageDecodeError en la 2ª foto: la 2ª queda error y la 3ª termina done", async () => {
  let calls = 0;
  const deps = fakeDeps({
    prepare: vi.fn(async (b: Blob) => {
      if (++calls === 2) throw new ImageDecodeError();
      return b;
    }),
  });
  const q = createUploadQueue(deps);
  await q.add([photo("a"), photo("b"), photo("c")]);
  expect(statuses(q.items())).toEqual(["done", "error", "done"]);
  expect(q.items()[1].error).toBe("No se puede leer esta foto");
});

test("BudgetExceededError en tag: estado paused_budget y el item sigue uploaded", async () => {
  const deps = fakeDeps({
    tag: vi.fn(async () => {
      throw new BudgetExceededError();
    }),
  });
  const q = createUploadQueue(deps);
  await q.add([photo("a"), photo("b")]);
  expect(q.state()).toBe("paused_budget");
  expect(statuses(q.items())).toEqual(["uploaded", "queued"]);
});

test("UnauthorizedError: estado paused_auth y ningún item pasa a error", async () => {
  const deps = fakeDeps({
    create: vi.fn(async () => {
      throw new UnauthorizedError();
    }),
  });
  const q = createUploadQueue(deps);
  await q.add([photo("a"), photo("b")]);
  expect(q.state()).toBe("paused_auth");
  expect(statuses(q.items())).toEqual(["queued", "queued"]);
});

test("retry(id) de un item en error lo vuelve a procesar desde donde falló", async () => {
  let fail = true;
  const deps = fakeDeps({
    upload: vi.fn(async () => {
      if (fail) throw new Error("red");
    }),
  });
  const q = createUploadQueue(deps);
  await q.add([photo("a")]);
  expect(q.items()[0]).toMatchObject({ status: "error", error: "No se ha podido subir. Reintenta." });
  fail = false;
  await q.retry(q.items()[0].id);
  expect(statuses(q.items())).toEqual(["done"]);
  expect(deps.create).toHaveBeenCalledTimes(1);
});

test("clearDone quita los terminados y conserva los errores", async () => {
  let calls = 0;
  const deps = fakeDeps({
    prepare: vi.fn(async (b: Blob) => {
      if (++calls === 1) throw new ImageDecodeError();
      return b;
    }),
  });
  const q = createUploadQueue(deps);
  await q.add([photo("a"), photo("b")]);
  await q.clearDone();
  expect(statuses(q.items())).toEqual(["error"]);
});

test("subscribe avisa de los cambios", async () => {
  const q = createUploadQueue(fakeDeps());
  const fn = vi.fn();
  q.subscribe(fn);
  await q.add([photo("a")]);
  expect(fn).toHaveBeenCalled();
});

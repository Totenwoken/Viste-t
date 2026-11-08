// @vitest-environment node
import { POST as wear } from "./wear.js";
import { POST as feedback } from "./feedback.js";
import { POST as wearOther } from "./wear-other.js";
import { fakeDb, garmentRow } from "../../server/testing/fakeDb.js";

let fake: ReturnType<typeof fakeDb>;
vi.mock("../../server/supabase.js", () => ({ BUCKET: "garments", ownerId: () => "owner-1", db: () => fake.client }));

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
const outfit = (id: string, over: Record<string, unknown> = {}) => ({
  id, user_id: "owner-1", mode: "auto", request: null, garment_ids: ["c", "p", "z"], locked_ids: [], explanation: "",
  status: "proposed", reject_reason: null, worn_on: null, created_at: "2026-11-08T08:00:00Z", ...over,
});
const req = (body: unknown, code = "c") =>
  new Request("http://x", { method: "POST", headers: { "x-access-code": code, "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  process.env.ACCESS_CODE = "c";
  fake = fakeDb({
    garments: [
      garmentRow({ id: "c", type: "camisa" }),
      garmentRow({ id: "p", type: "pantalon_chino" }),
      garmentRow({ id: "z", type: "calzado" }),
      garmentRow({ id: "ajena", user_id: "otro", type: "jersey" }),
    ],
    outfits: [outfit("o1"), outfit("o2", { status: "worn", worn_on: today }), outfit("ajeno", { user_id: "otro" })],
  });
});

const row = (id: string) => fake.tables.outfits.find((o) => o.id === id)!;

test("wear marca worn con la fecha de hoy y desmarca el worn anterior del mismo día", async () => {
  const r = await wear(req({ outfitId: "o1" }));
  expect(r.status).toBe(200);
  expect((await r.json()).outfit).toMatchObject({ id: "o1", status: "worn", wornOn: today });
  expect(row("o2")).toMatchObject({ status: "proposed", worn_on: null });
});

test("wear de un conjunto ajeno → 404", async () => {
  expect((await wear(req({ outfitId: "ajeno" }))).status).toBe(404);
});

test("feedback guarda el motivo; motivo desconocido → 400", async () => {
  const r = await feedback(req({ outfitId: "o1", reason: "colores" }));
  expect(r.status).toBe(200);
  expect(row("o1")).toMatchObject({ status: "rejected", reject_reason: "colores" });
  expect((await feedback(req({ outfitId: "o1", reason: "feo" }))).status).toBe(400);
});

test("feedback sin motivo rechaza con reject_reason null", async () => {
  await feedback(req({ outfitId: "o1" }));
  expect(row("o1")).toMatchObject({ status: "rejected", reject_reason: null });
});

test("feedback sobre un conjunto ya puesto → 409", async () => {
  expect((await feedback(req({ outfitId: "o2", reason: "colores" }))).status).toBe(409);
});

test("wear-other con una prenda ajena → 400", async () => {
  expect((await wearOther(req({ garmentIds: ["c", "ajena"] }))).status).toBe(400);
});

test("wear-other crea un conjunto manual puesto hoy y desmarca el anterior", async () => {
  const r = await wearOther(req({ garmentIds: ["c", "p", "z"] }));
  expect(r.status).toBe(201);
  const created = (await r.json()).outfit;
  expect(created).toMatchObject({ mode: "manual", status: "worn", wornOn: today, garmentIds: ["c", "p", "z"] });
  expect(row("o2")).toMatchObject({ status: "proposed", worn_on: null });
});

test("sin código → 401 en las tres", async () => {
  for (const h of [wear, feedback, wearOther]) expect((await h(req({}, "mal"))).status).toBe(401);
});

// @vitest-environment node
import { DELETE, GET, PATCH } from "./index.js";
import { fakeDb, garmentRow } from "../../server/testing/fakeDb.js";

let fake: ReturnType<typeof fakeDb>;

vi.mock("../../server/supabase.js", () => ({
  BUCKET: "garments",
  ownerId: () => "owner-1",
  db: () => fake.client,
}));

const H = { "x-access-code": "c", "content-type": "application/json" };
const JACKET = "11111111-1111-4111-8111-111111111111";
const TROUSERS = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  process.env.ACCESS_CODE = "c";
  fake = fakeDb({
    garments: [
      garmentRow({ id: JACKET, type: "chaqueta_traje", image_path: `owner-1/${JACKET}.webp` }),
      garmentRow({ id: TROUSERS, type: "pantalon_traje", image_path: `owner-1/${TROUSERS}.webp` }),
      garmentRow({ id: OTHER, user_id: "otro", image_path: `otro/${OTHER}.webp` }),
    ],
  });
});

test("GET devuelve solo prendas del propietario con imageUrl", async () => {
  const r = await GET(new Request("http://x/api/garments", { headers: H }));
  expect(r.status).toBe(200);
  const { garments } = await r.json();
  expect(garments.map((g: { id: string }) => g.id).sort()).toEqual([JACKET, TROUSERS].sort());
  expect(garments[0].imageUrl).toMatch(/^https:\/\/signed\/owner-1\//);
});

test("GET sin código → 401", async () => {
  expect((await GET(new Request("http://x/api/garments"))).status).toBe(401);
});

test("PATCH con formality 7 → 400", async () => {
  const r = await PATCH(new Request(`http://x/api/garments?id=${JACKET}`, { method: "PATCH", headers: H, body: '{"formality":7}' }));
  expect(r.status).toBe(400);
});

test("PATCH availability actualiza la prenda", async () => {
  const r = await PATCH(
    new Request(`http://x/api/garments?id=${JACKET}`, { method: "PATCH", headers: H, body: '{"availability":"lavanderia"}' }),
  );
  expect(r.status).toBe(200);
  expect((await r.json()).garment.availability).toBe("lavanderia");
});

test("PATCH suitPairId vincula ambas prendas", async () => {
  const r = await PATCH(
    new Request(`http://x/api/garments?id=${JACKET}`, { method: "PATCH", headers: H, body: JSON.stringify({ suitPairId: TROUSERS }) }),
  );
  expect(r.status).toBe(200);
  const byId = Object.fromEntries(fake.tables.garments.map((g) => [g.id, g]));
  expect(byId[JACKET].suit_pair_id).toBe(TROUSERS);
  expect(byId[TROUSERS].suit_pair_id).toBe(JACKET);
});

test("PATCH suitPairId null desvincula también a la pareja", async () => {
  fake.tables.garments[0].suit_pair_id = TROUSERS;
  fake.tables.garments[1].suit_pair_id = JACKET;
  await PATCH(new Request(`http://x/api/garments?id=${JACKET}`, { method: "PATCH", headers: H, body: '{"suitPairId":null}' }));
  expect(fake.tables.garments[1].suit_pair_id).toBeNull();
});

test("PATCH suitPairId hacia una prenda de otro usuario → 400", async () => {
  const r = await PATCH(
    new Request(`http://x/api/garments?id=${JACKET}`, { method: "PATCH", headers: H, body: JSON.stringify({ suitPairId: OTHER }) }),
  );
  expect(r.status).toBe(400);
});

test("PATCH de una prenda ajena → 404", async () => {
  const r = await PATCH(new Request(`http://x/api/garments?id=${OTHER}`, { method: "PATCH", headers: H, body: '{"formality":2}' }));
  expect(r.status).toBe(404);
});

test("DELETE desvincula la pareja de traje y borra el archivo", async () => {
  fake.tables.garments[0].suit_pair_id = TROUSERS;
  fake.tables.garments[1].suit_pair_id = JACKET;
  const r = await DELETE(new Request(`http://x/api/garments?id=${JACKET}`, { method: "DELETE", headers: H }));
  expect(r.status).toBe(204);
  expect(fake.tables.garments.find((g) => g.id === JACKET)).toBeUndefined();
  expect(fake.tables.garments.find((g) => g.id === TROUSERS)?.suit_pair_id).toBeNull();
  expect(fake.removed).toEqual([`owner-1/${JACKET}.webp`]);
});

test("PATCH con type de una prenda en error la pasa a ready y limpia el error", async () => {
  fake.tables.garments[0].status = "error";
  fake.tables.garments[0].type = null;
  fake.tables.garments[0].error = "No parece una prenda";
  const r = await PATCH(
    new Request(`http://x/api/garments?id=${JACKET}`, { method: "PATCH", headers: H, body: '{"type":"americana","description":"americana azul"}' }),
  );
  expect(r.status).toBe(200);
  expect((await r.json()).garment).toMatchObject({ status: "ready", error: null, type: "americana" });
});

test("PATCH de una prenda en error sin type sigue en error", async () => {
  fake.tables.garments[0].status = "error";
  fake.tables.garments[0].type = null;
  const r = await PATCH(new Request(`http://x/api/garments?id=${JACKET}`, { method: "PATCH", headers: H, body: '{"availability":"guardada"}' }));
  expect((await r.json()).garment.status).toBe("error");
});

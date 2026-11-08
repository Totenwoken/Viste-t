// @vitest-environment node
import { POST } from "./generate.js";
import { fakeDb, garmentRow } from "../../server/testing/fakeDb.js";

let fake: ReturnType<typeof fakeDb>;
const state = {
  usage: [] as unknown[][],
  overBudget: false,
  replies: [] as unknown[],
  prompts: [] as string[],
};

vi.mock("../../server/supabase.js", () => ({ BUCKET: "garments", ownerId: () => "owner-1", db: () => fake.client }));
vi.mock("../../server/budget.js", () => ({
  checkBudget: async () => (state.overBudget ? new Response('{"error":"budget_exceeded"}', { status: 402 }) : null),
  recordUsage: async (...args: unknown[]) => void state.usage.push(args),
}));
vi.mock("../../server/claude.js", () => ({
  modelFor: () => "claude-haiku-5-5",
  anthropic: () => ({
    messages: {
      parse: async (p: { messages: { content: string }[] }) => {
        state.prompts.push(p.messages[0].content);
        const next = state.replies.shift();
        if (!next) throw new Error("sin respuesta preparada");
        if (next instanceof Error) throw next;
        return next;
      },
    },
  }),
}));

const usage = { input_tokens: 3000, output_tokens: 200 };
const reply = (ids: string[], extra: Record<string, unknown> = {}) => ({
  stop_reason: "end_turn",
  usage,
  parsed_output: { garment_ids: ids, explanation: "Combina bien.", requested_ids: [], missing_request: null, ...extra },
});
const req = (body: unknown, code = "c") =>
  new Request("http://x/api/outfits/generate", {
    method: "POST", headers: { "x-access-code": code, "content-type": "application/json" }, body: JSON.stringify(body),
  });

beforeEach(() => {
  process.env.ACCESS_CODE = "c";
  state.usage = [];
  state.overBudget = false;
  state.replies = [];
  state.prompts = [];
  fake = fakeDb({
    garments: [
      garmentRow({ id: "c", type: "camisa", description: "camisa blanca", image_path: "owner-1/c.webp" }),
      garmentRow({ id: "cam", type: "camiseta", description: "camiseta blanca" }),
      garmentRow({ id: "sc", type: "sobrecamisa", description: "sobrecamisa verde" }),
      garmentRow({ id: "p", type: "pantalon_chino", description: "chino beige" }),
      garmentRow({ id: "z", type: "calzado", description: "zapatillas blancas" }),
      garmentRow({ id: "z2", type: "calzado", description: "botines marrones" }),
      garmentRow({ id: "lav", type: "jersey", description: "jersey gris", availability: "lavanderia" }),
      garmentRow({ id: "acc", type: "complemento", description: "reloj" }),
      garmentRow({ id: "ajena", user_id: "otro", type: "pantalon_vaquero", description: "vaquero ajeno" }),
    ],
    outfits: [],
    outfit_swaps: [],
  });
});

test("genera, valida, guarda y devuelve el conjunto con imageUrl", async () => {
  state.replies.push(reply(["c", "p", "z"]));
  const r = await POST(req({ mode: "auto", weather: { tempC: 14, minC: 9, maxC: 17, rainProb: 10, label: "Nubes", icon: "⛅" } }));
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.outfit).toMatchObject({ garmentIds: ["c", "p", "z"], status: "proposed", mode: "auto", explanation: "Combina bien.", notes: [] });
  expect(body.garments.map((g: { id: string }) => g.id)).toEqual(["c", "p", "z"]);
  expect(body.garments[0].imageUrl).toBe("https://signed/owner-1/c.webp");
  expect(fake.tables.outfits).toHaveLength(1);
  expect(fake.tables.outfits[0]).toMatchObject({ user_id: "owner-1", garment_ids: ["c", "p", "z"], status: "proposed" });
  expect(state.usage).toEqual([["outfit", "claude-haiku-5-5", usage]]);
});

test("el armario que recibe Claude no incluye complementos, prendas en lavandería ni ajenas", async () => {
  state.replies.push(reply(["c", "p", "z"]));
  await POST(req({ mode: "auto" }));
  // las prendas van en el system (cacheado); comprobamos a través de la validación: un id ajeno se rechaza
  state.replies.push(reply(["c", "ajena", "z"]), reply(["acc", "c", "p", "z"]));
  const r = await POST(req({ mode: "auto" }));
  expect(r.status).toBe(422);
});

test("id inventado por Claude → reintento con el problema y éxito al segundo intento", async () => {
  state.replies.push(reply(["c", "p", "inventada"]), reply(["c", "p", "z"]));
  const r = await POST(req({ mode: "auto" }));
  expect(r.status).toBe(200);
  expect(state.prompts).toHaveLength(2);
  expect(state.prompts[1]).toContain("no está disponible");
  expect(state.prompts[1]).toContain("falta calzado");
});

test("dos respuestas inválidas → 422 invalid_outfit y se registra el gasto de ambas", async () => {
  state.replies.push(reply(["c", "p"]), reply(["c"]));
  const r = await POST(req({ mode: "auto" }));
  expect(r.status).toBe(422);
  expect(await r.json()).toEqual({ error: "invalid_outfit", message: "No he conseguido montar un conjunto válido. Prueba otra vez." });
  expect(state.usage).toHaveLength(2);
  expect(fake.tables.outfits).toHaveLength(0);
});

test("refusal de Claude → reintento y, si persiste, 422", async () => {
  state.replies.push({ stop_reason: "refusal", parsed_output: null, usage }, { stop_reason: "refusal", parsed_output: null, usage });
  const r = await POST(req({ mode: "auto" }));
  expect(r.status).toBe(422);
});

test("sin vaqueros disponibles → 422 not_enough sin llamar a Claude", async () => {
  const r = await POST(req({ mode: "vaqueros" }));
  expect(r.status).toBe(422);
  expect(await r.json()).toEqual({ error: "not_enough", message: "No tienes vaqueros disponibles" });
  expect(state.prompts).toHaveLength(0);
});

test("prenda bloqueada que pasó a lavandería se quita y añade nota", async () => {
  state.replies.push(reply(["c", "p", "z"]));
  const r = await POST(req({ mode: "auto", lockedIds: ["lav", "c"] }));
  const body = await r.json();
  expect(body.outfit.notes).toContain("«jersey gris» ya no está disponible y la he quitado");
  expect(body.outfit.lockedIds).toEqual(["c"]);
  expect(state.prompts[0]).not.toContain("lav (");
});

test("prenda bloqueada que ya no existe → nota genérica", async () => {
  state.replies.push(reply(["c", "p", "z"]));
  const body = await (await POST(req({ mode: "auto", lockedIds: ["borrada"] }))).json();
  expect(body.outfit.notes).toContain("Una prenda bloqueada ya no está en tu armario");
});

test("missing_request añade la nota 'No he encontrado «zapatillas rojas» en tu armario'", async () => {
  state.replies.push(reply(["c", "p", "z"], { missing_request: "zapatillas rojas" }));
  const body = await (await POST(req({ mode: "auto", request: "zapatillas rojas" }))).json();
  expect(body.outfit.notes).toContain("No he encontrado «zapatillas rojas» en tu armario");
  expect(body.outfit.request).toBe("zapatillas rojas");
});

test("replaceId: bloquea el resto del conjunto anterior, excluye esa prenda y registra el swap", async () => {
  fake.tables.outfits.push({
    id: "o1", user_id: "owner-1", mode: "auto", request: null, garment_ids: ["c", "p", "z"], locked_ids: [],
    explanation: "", status: "proposed", reject_reason: null, worn_on: null, created_at: "2026-11-08T08:00:00Z",
  });
  state.replies.push(reply(["c", "p", "z2"]));
  const r = await POST(req({ mode: "auto", previousOutfitId: "o1", replaceId: "z" }));
  const body = await r.json();
  expect(body.outfit.garmentIds).toEqual(["c", "p", "z2"]);
  expect(state.prompts[0]).toMatch(/bloqueadas.*c \(camisa blanca\).*p \(chino beige\)/);
  expect(state.prompts[0]).toMatch(/excluidas.*z \(zapatillas blancas\)/);
  expect(fake.tables.outfit_swaps).toEqual([expect.objectContaining({ user_id: "owner-1", outfit_id: "o1", garment_id: "z" })]);
});

test("Claude no puede usar la prenda excluida", async () => {
  fake.tables.outfits.push({
    id: "o1", user_id: "owner-1", mode: "auto", request: null, garment_ids: ["c", "p", "z"], locked_ids: [],
    explanation: "", status: "proposed", reject_reason: null, worn_on: null, created_at: "2026-11-08T08:00:00Z",
  });
  state.replies.push(reply(["c", "p", "z"]), reply(["c", "p", "z"]));
  const r = await POST(req({ mode: "auto", previousOutfitId: "o1", replaceId: "z" }));
  expect(r.status).toBe(422);
});

test("las prendas pedidas (requested_ids) quedan en locked_ids", async () => {
  state.replies.push(reply(["cam", "sc", "p", "z"], { requested_ids: ["sc"] }));
  const body = await (await POST(req({ mode: "auto", request: "sobrecamisa verde" }))).json();
  expect(body.outfit.lockedIds).toEqual(["sc"]);
  expect(fake.tables.outfits[0].locked_ids).toEqual(["sc"]);
});

test("el historial (lo puesto y lo rechazado) llega a Claude", async () => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  fake.tables.outfits.push(
    { id: "o1", user_id: "owner-1", mode: "auto", garment_ids: ["c", "p", "z"], locked_ids: [], explanation: "", status: "worn", reject_reason: null, worn_on: today, created_at: new Date().toISOString() },
    { id: "o2", user_id: "owner-1", mode: "auto", garment_ids: ["cam", "p", "z2"], locked_ids: [], explanation: "", status: "rejected", reject_reason: "colores", worn_on: null, created_at: new Date().toISOString() },
  );
  state.replies.push(reply(["cam", "sc", "p", "z"]));
  await POST(req({ mode: "auto" }));
  expect(state.prompts[0]).toContain("Puestas en los últimos 7 días: c, p, z");
  expect(state.prompts[0]).toContain("rechazado (colores)");
});

test("presupuesto agotado → 402", async () => {
  state.overBudget = true;
  const r = await POST(req({ mode: "auto" }));
  expect(r.status).toBe(402);
  expect(state.prompts).toHaveLength(0);
});

test("body inválido → 400", async () => {
  expect((await POST(req({ mode: "pijama" }))).status).toBe(400);
});

test("sin código → 401", async () => {
  expect((await POST(req({ mode: "auto" }, "mal"))).status).toBe(401);
});

const prevOutfit = () =>
  fake.tables.outfits.push({
    id: "o1", user_id: "owner-1", mode: "auto", request: null, garment_ids: ["c", "p", "z"], locked_ids: [],
    explanation: "", status: "proposed", reject_reason: null, worn_on: null, created_at: "2026-11-08T08:00:00Z",
  });

test("'Otro' (previousOutfitId sin replaceId) le dice a Claude cuál es el conjunto anterior", async () => {
  prevOutfit();
  state.replies.push(reply(["cam", "sc", "p", "z2"]));
  const r = await POST(req({ mode: "auto", previousOutfitId: "o1" }));
  expect(r.status).toBe(200);
  expect(state.prompts[0]).toContain("Conjunto anterior (propón uno distinto): c, p, z");
});

test("'Otro' que repite exactamente el conjunto anterior provoca un reintento", async () => {
  prevOutfit();
  state.replies.push(reply(["c", "p", "z"]), reply(["cam", "p", "z2"]));
  const body = await (await POST(req({ mode: "auto", previousOutfitId: "o1" }))).json();
  expect(body.outfit.garmentIds).toEqual(["cam", "p", "z2"]);
  expect(state.prompts[1]).toContain("es el mismo conjunto que el anterior");
});

test("tras 'Cambiar solo esta' solo quedan bloqueadas las que bloqueó el usuario", async () => {
  prevOutfit();
  state.replies.push(reply(["c", "p", "z2"]));
  const body = await (await POST(req({ mode: "auto", previousOutfitId: "o1", replaceId: "z", lockedIds: ["c"] }))).json();
  expect(body.outfit.lockedIds).toEqual(["c"]);
  expect(fake.tables.outfits.at(-1)!.locked_ids).toEqual(["c"]);
});

test("una prenda pedida que se acaba de cambiar no se exige (requested_ids filtrados por el armario sin excluidas)", async () => {
  prevOutfit();
  state.replies.push(reply(["c", "p", "z2"], { requested_ids: ["z"] }));
  const r = await POST(req({ mode: "auto", request: "zapatillas blancas", previousOutfitId: "o1", replaceId: "z" }));
  expect(r.status).toBe(200);
});

test("si el SDK lanza un error al interpretar la respuesta, cuenta como intento fallido y se reintenta", async () => {
  state.replies.push(new Error("Failed to parse structured output"), reply(["c", "p", "z"]));
  const r = await POST(req({ mode: "auto" }));
  expect(r.status).toBe(200);
  expect(state.prompts).toHaveLength(2);
});

test("si las dos llamadas lanzan error → 422 legible, no un 500", async () => {
  state.replies.push(new Error("boom"), new Error("boom"));
  const r = await POST(req({ mode: "auto" }));
  expect(r.status).toBe(422);
});

// @vitest-environment node
import { POST } from "./tag";

const state = {
  row: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  usage: [] as unknown[],
  overBudget: false,
  claude: null as null | (() => unknown),
  parseCalls: 0,
};

vi.mock("../../server/supabase", () => ({
  BUCKET: "garments",
  ownerId: () => "owner-1",
  db: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }) }),
      }),
      update: (u: Record<string, unknown>) => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: async () => {
                state.updates.push(u);
                state.row = { ...state.row, ...u };
                return { data: state.row, error: null };
              },
            }),
          }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }), error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "https://signed" }, error: null }),
      }),
    },
  }),
}));

vi.mock("../../server/budget", () => ({
  checkBudget: async () =>
    state.overBudget ? new Response('{"error":"budget_exceeded"}', { status: 402 }) : null,
  recordUsage: async (...args: unknown[]) => {
    state.usage.push(args);
  },
}));

vi.mock("../../server/claude", () => ({
  modelFor: () => "claude-haiku-5-5",
  anthropic: () => ({
    messages: {
      parse: async () => {
        state.parseCalls++;
        return state.claude!();
      },
    },
  }),
}));

const baseRow = {
  id: "g1", user_id: "owner-1", status: "pending", image_path: "owner-1/g1.webp", type: null, description: null,
  colors: [], formality: null, seasons: [], pattern: null, material: null, availability: "disponible",
  suit_pair_id: null, jacket_combinable: false, error: null, created_at: "2026-11-06T10:00:00Z", updated_at: "2026-11-06T10:00:00Z",
};
const usage = { input_tokens: 900, output_tokens: 120 };
const req = (body: unknown) =>
  new Request("http://x/api/garments/tag", {
    method: "POST", headers: { "x-access-code": "c", "content-type": "application/json" }, body: JSON.stringify(body),
  });

beforeEach(() => {
  process.env.ACCESS_CODE = "c";
  state.row = { ...baseRow };
  state.updates = [];
  state.usage = [];
  state.overBudget = false;
  state.parseCalls = 0;
  state.claude = () => ({
    stop_reason: "end_turn", usage,
    parsed_output: {
      is_garment: true, type: "camisa", description: "camisa oxford azul", colors: ["azul"], formality: 3,
      seasons: ["primavera"], pattern: null, material: "algodón",
    },
  });
});

test("sin código → 401", async () => {
  const r = await POST(new Request("http://x", { method: "POST", body: "{}" }));
  expect(r.status).toBe(401);
});

test("prenda ya ready → no llama a Claude", async () => {
  state.row = { ...baseRow, status: "ready", type: "camisa" };
  const r = await POST(req({ garmentId: "g1" }));
  expect(r.status).toBe(200);
  expect(state.parseCalls).toBe(0);
});

test("presupuesto agotado → 402 y la fila sigue pending", async () => {
  state.overBudget = true;
  const r = await POST(req({ garmentId: "g1" }));
  expect(r.status).toBe(402);
  expect(state.updates).toHaveLength(0);
  expect(state.parseCalls).toBe(0);
});

test("respuesta válida → fila ready con type/colors/formality y se registra el uso", async () => {
  const r = await POST(req({ garmentId: "g1" }));
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.garment).toMatchObject({ status: "ready", type: "camisa", colors: ["azul"], formality: 3, error: null });
  expect(state.usage).toEqual([["tagging", "claude-haiku-5-5", usage]]);
});

test("refusal → fila error con mensaje, respuesta 200", async () => {
  state.claude = () => ({ stop_reason: "refusal", parsed_output: null, usage });
  const r = await POST(req({ garmentId: "g1" }));
  expect(r.status).toBe(200);
  expect((await r.json()).garment).toMatchObject({ status: "error", error: "Claude no ha podido analizar esta foto" });
  expect(state.usage).toHaveLength(1);
});

test("Claude lanza un error de red → fila error 'No se ha podido analizar. Reintenta.'", async () => {
  state.claude = () => {
    throw new Error("network");
  };
  const r = await POST(req({ garmentId: "g1" }));
  expect(r.status).toBe(200);
  expect((await r.json()).garment).toMatchObject({ status: "error", error: "No se ha podido analizar. Reintenta." });
});

test("prenda inexistente → 404", async () => {
  state.row = null;
  const r = await POST(req({ garmentId: "nope" }));
  expect(r.status).toBe(404);
});

test("body sin garmentId → 400", async () => {
  const r = await POST(req({}));
  expect(r.status).toBe(400);
});

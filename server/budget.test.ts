// @vitest-environment node
import { checkBudget, costUsd, monthStartUtc, recordUsage } from "./budget";

const rows: { cost_usd: number }[] = [];
const inserted: Record<string, unknown>[] = [];
const gteCalls: string[] = [];

vi.mock("./supabase", () => ({
  ownerId: () => "owner-1",
  db: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: async (_col: string, iso: string) => {
            gteCalls.push(iso);
            return { data: rows, error: null };
          },
        }),
      }),
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

beforeEach(() => {
  rows.length = 0;
  inserted.length = 0;
  gteCalls.length = 0;
  delete process.env.MONTHLY_BUDGET_USD;
});

test("costUsd Haiku: 1M de entrada + 1M de salida = 0,60 $", () => {
  expect(costUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
});

test("costUsd aplica 0,1× a lectura de caché y 1,25× a escritura", () => {
  expect(
    costUsd("claude-haiku-5-5", {
      input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000,
    }),
  ).toBeCloseTo(0.01 + 0.125);
});

test("modelo desconocido → precio de Opus", () => {
  expect(costUsd("x", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(4);
});

test("monthStartUtc(2026-11-06T10:00Z) = 2026-11-01T00:00Z", () => {
  expect(monthStartUtc(new Date("2026-11-06T10:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
});

test("checkBudget devuelve 402 cuando el gasto del mes iguala el tope", async () => {
  process.env.MONTHLY_BUDGET_USD = "5";
  rows.push({ cost_usd: 3 }, { cost_usd: 2 });
  const r = await checkBudget();
  expect(r?.status).toBe(402);
  expect(await r?.json()).toEqual({ error: "budget_exceeded" });
});

test("checkBudget devuelve null por debajo del tope (5 $ por defecto) y filtra desde el inicio de mes", async () => {
  rows.push({ cost_usd: 4.99 });
  expect(await checkBudget()).toBeNull();
  expect(gteCalls[0]).toMatch(/-01T00:00:00\.000Z$/);
});

test("recordUsage guarda tokens y coste del propietario", async () => {
  await recordUsage("tagging", "claude-haiku-5-5", { input_tokens: 1000, output_tokens: 200 });
  expect(inserted[0]).toMatchObject({
    user_id: "owner-1", task: "tagging", model: "claude-haiku-5-5", input_tokens: 1000, output_tokens: 200,
    cache_read_tokens: 0, cache_write_tokens: 0,
  });
  expect(inserted[0].cost_usd as number).toBeCloseTo(0.0001 + 0.0001);
});

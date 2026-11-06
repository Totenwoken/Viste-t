// @vitest-environment node
import { POST } from "./upload-url.js";

const state = { row: null as Record<string, unknown> | null, owner: [] as string[] };

vi.mock("../../server/supabase.js", () => ({
  BUCKET: "garments",
  ownerId: () => "owner-1",
  db: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: (_c: string, v: string) => {
            state.owner.push(v);
            return { maybeSingle: async () => ({ data: state.row, error: null }) };
          },
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://up/${path}` }, error: null }),
      }),
    },
  }),
}));

const req = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { "x-access-code": "c" }, body: JSON.stringify(body) });

beforeEach(() => {
  process.env.ACCESS_CODE = "c";
  state.row = { id: "g1", image_path: "owner-1/g1.webp" };
  state.owner = [];
});

test("devuelve una URL nueva para la foto de la prenda", async () => {
  const r = await POST(req({ garmentId: "g1" }));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ uploadUrl: "https://up/owner-1/g1.webp" });
  expect(state.owner).toEqual(["owner-1"]);
});

test("upload-url de una prenda de otro usuario → 404", async () => {
  state.row = null;
  const r = await POST(req({ garmentId: "g-ajena" }));
  expect(r.status).toBe(404);
});

test("sin código → 401", async () => {
  const r = await POST(new Request("http://x", { method: "POST", body: "{}" }));
  expect(r.status).toBe(401);
});

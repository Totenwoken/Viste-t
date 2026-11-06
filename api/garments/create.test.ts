// @vitest-environment node
import { POST } from "./create.js";

const state = { inserted: [] as Record<string, unknown>[], signedPaths: [] as string[] };

vi.mock("../../server/supabase.js", () => ({
  BUCKET: "garments",
  ownerId: () => "owner-1",
  db: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            state.inserted.push(row);
            return { data: { ...row }, error: null };
          },
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          state.signedPaths.push(path);
          return { data: { signedUrl: `https://storage/upload/${path}?token=t`, token: "t", path }, error: null };
        },
      }),
    },
  }),
}));

beforeEach(() => {
  process.env.ACCESS_CODE = "c";
  state.inserted = [];
  state.signedPaths = [];
});

test("create → 201 con garmentId y uploadUrl; fila pending con image_path <owner>/<id>.webp", async () => {
  const r = await POST(new Request("http://x", { method: "POST", headers: { "x-access-code": "c" } }));
  expect(r.status).toBe(201);
  const body = await r.json();
  expect(body.garmentId).toMatch(/^[0-9a-f-]{36}$/);
  expect(body.uploadUrl).toContain(`owner-1/${body.garmentId}.webp`);
  expect(state.inserted[0]).toMatchObject({
    id: body.garmentId, user_id: "owner-1", status: "pending", image_path: `owner-1/${body.garmentId}.webp`,
  });
});

test("create sin código → 401", async () => {
  const r = await POST(new Request("http://x", { method: "POST" }));
  expect(r.status).toBe(401);
  expect(state.inserted).toHaveLength(0);
});

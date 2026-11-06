// @vitest-environment node
import { requireAccess } from "./access";
import { GET } from "../api/auth/check";

beforeEach(() => {
  process.env.ACCESS_CODE = "armario123";
});

test("sin cabecera → 401", async () => {
  const r = requireAccess(new Request("http://x/api"));
  expect(r?.status).toBe(401);
  expect(await r?.json()).toEqual({ error: "unauthorized" });
});

test("código incorrecto (otra longitud) → 401", () => {
  expect(requireAccess(new Request("http://x", { headers: { "x-access-code": "no" } }))?.status).toBe(401);
});

test("código incorrecto (misma longitud) → 401", () => {
  expect(requireAccess(new Request("http://x", { headers: { "x-access-code": "armario124" } }))?.status).toBe(401);
});

test("código correcto → null", () => {
  expect(requireAccess(new Request("http://x", { headers: { "x-access-code": "armario123" } }))).toBeNull();
});

test("si ACCESS_CODE no está configurado, nadie entra", () => {
  delete process.env.ACCESS_CODE;
  expect(requireAccess(new Request("http://x", { headers: { "x-access-code": "" } }))?.status).toBe(401);
});

test("GET /api/auth/check → 200 {ok:true} con código válido", async () => {
  const r = await GET(new Request("http://x/api/auth/check", { headers: { "x-access-code": "armario123" } }));
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ ok: true });
});

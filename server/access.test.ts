// @vitest-environment node
import { requireAccess } from "./access.js";
import { GET } from "../api/auth/check.js";

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

test("GET /api/auth/check sin código indica si el servidor tiene un código configurado", async () => {
  const r = await GET(new Request("http://x/api/auth/check"));
  expect(r.status).toBe(401);
  expect(await r.json()).toMatchObject({ error: "unauthorized", configured: true });
});

test("GET /api/auth/check indica configured:false si falta ACCESS_CODE", async () => {
  delete process.env.ACCESS_CODE;
  const r = await GET(new Request("http://x/api/auth/check", { headers: { "x-access-code": "algo" } }));
  expect(await r.json()).toMatchObject({ error: "unauthorized", configured: false });
});

test("GET /api/auth/check sin acceso informa qué variables existen (sin valores), el entorno y el commit", async () => {
  process.env.SUPABASE_URL = "https://x.supabase.co";
  delete process.env.ANTHROPIC_API_KEY;
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_GIT_COMMIT_SHA = "abc1234def";
  const r = await GET(new Request("http://x/api/auth/check"));
  const body = await r.json();
  expect(body.env).toMatchObject({ ACCESS_CODE: true, SUPABASE_URL: true, ANTHROPIC_API_KEY: false });
  expect(body.vercelEnv).toBe("production");
  expect(body.commit).toBe("abc1234");
  expect(JSON.stringify(body)).not.toContain("armario123");
  expect(JSON.stringify(body)).not.toContain("x.supabase.co");
});

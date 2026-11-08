// @vitest-environment node
import { normalizeSupabaseUrl } from "./supabase.js";

test("deja la dirección base tal cual", () => {
  expect(normalizeSupabaseUrl("https://abcd.supabase.co")).toBe("https://abcd.supabase.co");
});

test("quita /rest/v1/ y barras finales copiadas de más", () => {
  expect(normalizeSupabaseUrl("https://abcd.supabase.co/rest/v1/")).toBe("https://abcd.supabase.co");
  expect(normalizeSupabaseUrl("https://abcd.supabase.co/")).toBe("https://abcd.supabase.co");
});

test("quita espacios y comillas alrededor", () => {
  expect(normalizeSupabaseUrl('  "https://abcd.supabase.co"  ')).toBe("https://abcd.supabase.co");
});

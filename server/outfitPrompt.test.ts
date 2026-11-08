// @vitest-environment node
import type { Garment, GarmentType } from "../shared/garment.js";
import { DEFAULT_STYLE_PROFILE } from "../shared/styleProfile.js";
import { buildOutfitRequest, interpretOutfit, wardrobeBlock, type OutfitContext } from "./outfitPrompt.js";

function g(id: string, type: GarmentType, description: string): Garment {
  return {
    id, status: "ready", type, description, colors: ["azul marino"], formality: 3, seasons: ["otono", "invierno"],
    pattern: null, material: null, availability: "disponible", suitPairId: null, jacketCombinable: false, error: null,
    createdAt: "2026-11-08T10:00:00Z",
  };
}

const wardrobe = [g("z", "calzado", "zapatillas blancas de piel"), g("c", "camisa", "camisa oxford azul"), g("p", "pantalon_chino", "chino verde")];
const ctx: OutfitContext = {
  today: "2026-11-08", weather: { tempC: 14, minC: 9, maxC: 17, rainProb: 10, label: "Nubes y claros", icon: "⛅" },
  mode: "auto", request: null, lockedIds: [], excludedIds: [], wornRecently: [], history: [],
};

const systemText = (p: ReturnType<typeof buildOutfitRequest>) => p.system.map((b) => b.text).join("\n");

test("wardrobeBlock lista una línea por prenda ordenada por id", () => {
  const lines = wardrobeBlock(wardrobe).split("\n");
  expect(lines).toHaveLength(3);
  expect(lines.map((l) => l.split(" | ")[0])).toEqual(["c", "p", "z"]);
  expect(lines[0]).toContain("camisa oxford azul");
});

test("buildOutfitRequest pone el armario en el system con cache_control y usa el modelo indicado", () => {
  const p = buildOutfitRequest(wardrobe, ctx, "claude-haiku-5-5");
  expect(p.model).toBe("claude-haiku-5-5");
  const last = p.system[p.system.length - 1];
  expect(last.text).toContain("chino verde");
  expect(last.cache_control).toEqual({ type: "ephemeral" });
  expect(p.output_config.effort).toBe("low");
});

test("el system incluye DEFAULT_STYLE_PROFILE antes del armario", () => {
  const text = systemText(buildOutfitRequest(wardrobe, ctx, "m"));
  expect(text.indexOf(DEFAULT_STYLE_PROFILE)).toBeGreaterThan(-1);
  expect(text.indexOf(DEFAULT_STYLE_PROFILE)).toBeLessThan(text.indexOf("chino verde"));
});

test("el system no cambia entre peticiones con el mismo armario (para la caché)", () => {
  const a = buildOutfitRequest(wardrobe, ctx, "m");
  const b = buildOutfitRequest([...wardrobe].reverse(), { ...ctx, mode: "formal", request: "algo" }, "m");
  expect(JSON.stringify(a.system)).toBe(JSON.stringify(b.system));
});

test("el mensaje de usuario incluye modo, pedido, bloqueadas, tiempo y problemas del reintento", () => {
  const p = buildOutfitRequest(
    wardrobe,
    { ...ctx, mode: "vaqueros", request: "zapatillas marrones", lockedIds: ["z"], retryProblems: ["falta calzado"] },
    "claude-haiku-5-5",
  );
  const text = JSON.stringify(p.messages);
  for (const s of ["vaqueros", "zapatillas marrones", "z", "falta calzado", "14"]) expect(text).toContain(s);
});

test("el mensaje incluye historial con motivos y lo puesto en los últimos días", () => {
  const p = buildOutfitRequest(
    wardrobe,
    { ...ctx, wornRecently: ["c"], history: [{ garmentIds: ["c", "p", "z"], status: "rejected", rejectReason: "colores", date: "2026-11-07" }] },
    "m",
  );
  const text = JSON.stringify(p.messages);
  expect(text).toContain("colores");
  expect(text).toContain("rechazado");
});

test("sin tiempo no menciona temperatura", () => {
  const text = JSON.stringify(buildOutfitRequest(wardrobe, { ...ctx, weather: null }, "m").messages);
  expect(text).not.toContain("°C");
});

test("interpretOutfit: refusal → error legible", () => {
  expect(interpretOutfit({ stop_reason: "refusal", parsed_output: null })).toEqual({
    ok: false, error: "Claude no ha podido proponer un conjunto",
  });
});

test("interpretOutfit: sin parsed_output o max_tokens → 'Respuesta no válida'", () => {
  expect(interpretOutfit({ stop_reason: "end_turn", parsed_output: null })).toEqual({ ok: false, error: "Respuesta no válida" });
  expect(interpretOutfit({ stop_reason: "max_tokens", parsed_output: { garment_ids: [] } })).toEqual({ ok: false, error: "Respuesta no válida" });
});

test("interpretOutfit: válido → out", () => {
  const out = { garment_ids: ["c", "p", "z"], explanation: "Va bien.", requested_ids: [], missing_request: null };
  expect(interpretOutfit({ stop_reason: "end_turn", parsed_output: out })).toEqual({ ok: true, out });
});

test("el tiempo incluye primera hora y anochecer cuando se conocen", () => {
  const text = JSON.stringify(buildOutfitRequest(wardrobe, { ...ctx, weather: { ...ctx.weather!, morningC: 11.6, eveningC: 13.2 } }, "m").messages);
  expect(text).toContain("a las 8:00 12 °C");
  expect(text).toContain("a las 21:00 13 °C");
});

test("las reglas piden una capa fácil de quitar si refresca por la mañana o la noche", () => {
  expect(systemText(buildOutfitRequest(wardrobe, ctx, "m"))).toContain("capa fácil de quitar");
});

test("en modo 'añadir capa' el mensaje pide una sola prenda más de las capas libres", () => {
  const text = JSON.stringify(buildOutfitRequest(wardrobe, { ...ctx, lockedIds: ["c", "p", "z"], addLayer: ["mid", "outer"] }, "m").messages);
  expect(text).toContain("Añade UNA sola prenda");
  expect(text).toContain("jersey");
  expect(text).toContain("prenda de fuera");
});

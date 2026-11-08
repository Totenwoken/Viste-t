import type { Garment, GarmentType } from "./garment.js";
import { missingForMode, validateOutfit } from "./outfit.js";

function g(id: string, type: GarmentType, over: Partial<Garment> = {}): Garment {
  return {
    id, status: "ready", type, description: `${type} ${id}`, colors: ["azul"], formality: 3, seasons: ["otono"],
    pattern: null, material: null, availability: "disponible", suitPairId: null, jacketCombinable: false, error: null,
    createdAt: "2026-11-08T10:00:00Z", ...over,
  };
}

const wardrobe: Garment[] = [
  g("c", "camisa"),
  g("cam", "camiseta"),
  g("jersey", "jersey"),
  g("j", "jersey"),
  g("sc", "sobrecamisa"),
  g("caz", "cazadora"),
  g("am", "americana"),
  g("jt", "chaqueta_traje", { suitPairId: "pt" }),
  g("pt", "pantalon_traje", { suitPairId: "jt" }),
  g("pv", "pantalon_otro"),
  g("p", "pantalon_chino"),
  g("v", "pantalon_vaquero"),
  g("z", "calzado"),
  g("acc", "complemento"),
  g("lav", "camisa", { availability: "lavanderia" }),
];
const auto = { mode: "auto" as const, lockedIds: [] };

test("camiseta + sobrecamisa (outer) + chino + calzado es válido", () => {
  expect(validateOutfit(["cam", "sc", "p", "z"], wardrobe, auto)).toEqual({ ok: true });
});

test("jersey fino + sobrecamisa es válido", () => {
  expect(validateOutfit(["jersey", "sc", "v", "z"], wardrobe, auto)).toEqual({ ok: true });
});

test("un complemento en el conjunto no es válido", () => {
  expect(validateOutfit(["c", "p", "z", "acc"], wardrobe, auto).ok).toBe(false);
});

test("conjunto mínimo válido: camisa + chino + calzado", () => {
  expect(validateOutfit(["c", "p", "z"], wardrobe, auto)).toEqual({ ok: true });
});

test("un jersey solo, sin camiseta debajo, es válido", () => {
  expect(validateOutfit(["jersey", "v", "z"], wardrobe, auto)).toEqual({ ok: true });
});

test("sin ninguna prenda de torso no es válido", () => {
  expect(validateOutfit(["v", "z"], wardrobe, auto)).toEqual({
    ok: false,
    problems: expect.arrayContaining(["falta una prenda de arriba o un jersey"]),
  });
});

test("formal acepta jersey de cuello alto sin camisa y rechaza camiseta", () => {
  expect(validateOutfit(["jersey", "pv", "z"], wardrobe, { mode: "formal", lockedIds: [] }).ok).toBe(true);
  expect(validateOutfit(["cam", "pv", "z"], wardrobe, { mode: "formal", lockedIds: [] }).ok).toBe(false);
});

test("falta calzado y sobra un pantalón", () => {
  const r = validateOutfit(["c", "p", "v"], wardrobe, auto);
  expect(r).toEqual({ ok: false, problems: expect.arrayContaining(["falta calzado", "hay 2 prendas de abajo"]) });
});

test("rechaza prendas en la lavandería o desconocidas", () => {
  expect(validateOutfit(["c", "p", "z", "lav"], wardrobe.filter((x) => x.availability === "disponible"), auto).ok).toBe(false);
  expect(validateOutfit(["c", "p", "z", "inventada"], wardrobe, auto).ok).toBe(false);
});

test("vaqueros exige pantalón vaquero", () => {
  expect(validateOutfit(["c", "p", "z"], wardrobe, { mode: "vaqueros", lockedIds: [] }).ok).toBe(false);
  expect(validateOutfit(["c", "v", "z"], wardrobe, { mode: "vaqueros", lockedIds: [] }).ok).toBe(true);
});

test("chinos exige pantalón chino", () => {
  expect(validateOutfit(["cam", "v", "z"], wardrobe, { mode: "chinos", lockedIds: [] }).ok).toBe(false);
  expect(validateOutfit(["cam", "p", "z"], wardrobe, { mode: "chinos", lockedIds: [] }).ok).toBe(true);
});

test("traje acepta americana + pantalón de vestir + camisa y rechaza vaqueros", () => {
  expect(validateOutfit(["c", "am", "pv", "z"], wardrobe, { mode: "traje", lockedIds: [] }).ok).toBe(true);
  expect(validateOutfit(["c", "am", "v", "z"], wardrobe, { mode: "traje", lockedIds: [] }).ok).toBe(false);
});

test("traje sin americana ni chaqueta de traje no es válido", () => {
  expect(validateOutfit(["c", "pv", "z"], wardrobe, { mode: "traje", lockedIds: [] }).ok).toBe(false);
});

test("formal rechaza vaqueros y cazadora", () => {
  expect(validateOutfit(["c", "v", "z"], wardrobe, { mode: "formal", lockedIds: [] }).ok).toBe(false);
  expect(validateOutfit(["c", "caz", "pv", "z"], wardrobe, { mode: "formal", lockedIds: [] }).ok).toBe(false);
  expect(validateOutfit(["c", "am", "pv", "z"], wardrobe, { mode: "formal", lockedIds: [] }).ok).toBe(true);
});

test("traje exige chaqueta y su pantalón vinculado", () => {
  expect(validateOutfit(["c", "jt", "pt", "z"], wardrobe, { mode: "traje", lockedIds: [] }).ok).toBe(true);
  expect(validateOutfit(["c", "jt", "p", "z"], wardrobe, { mode: "traje", lockedIds: [] }).ok).toBe(false);
});

test("chaqueta de traje no combinable no puede ir con otro pantalón en auto", () => {
  expect(validateOutfit(["c", "jt", "p", "z"], wardrobe, auto).ok).toBe(false);
});

test("chaqueta de traje combinable sí puede ir con otro pantalón", () => {
  const w = wardrobe.map((x) => (x.id === "jt" ? { ...x, jacketCombinable: true } : x));
  expect(validateOutfit(["c", "jt", "p", "z"], w, auto).ok).toBe(true);
});

test("las prendas bloqueadas deben estar", () => {
  const r = validateOutfit(["c", "p", "z"], wardrobe, { mode: "auto", lockedIds: ["j"] });
  expect(r).toEqual({ ok: false, problems: expect.arrayContaining(["falta la prenda bloqueada jersey j"]) });
});

test("ids repetidos no son válidos", () => {
  expect(validateOutfit(["c", "c", "p", "z"], wardrobe, auto).ok).toBe(false);
});

test("missingForMode: sin vaqueros disponibles", () => {
  expect(missingForMode(wardrobe.filter((x) => x.type !== "pantalon_vaquero"), "vaqueros")).toBe("No tienes vaqueros disponibles");
});

test("missingForMode: sin calzado", () => {
  expect(missingForMode(wardrobe.filter((x) => x.type !== "calzado"), "auto")).toBe(
    "Necesitas al menos una prenda de arriba o un jersey, una de abajo y calzado disponibles",
  );
});

test("missingForMode: traje sin traje ni americana", () => {
  expect(missingForMode(wardrobe.filter((x) => !["americana", "chaqueta_traje"].includes(x.type!)), "traje")).toBe(
    "Necesitas un traje vinculado o una americana con pantalón de vestir",
  );
});

test("missingForMode: armario suficiente → null", () => {
  for (const m of ["auto", "vaqueros", "formal", "traje", "chinos"] as const) expect(missingForMode(wardrobe, m)).toBeNull();
});

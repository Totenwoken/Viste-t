import { GARMENT_TYPES, GarmentPatchSchema, layerOf } from "./garment.js";

test("layerOf clasifica cada tipo", () => {
  expect(layerOf("camisa")).toBe("top");
  expect(layerOf("jersey")).toBe("mid");
  expect(layerOf("pantalon_chino")).toBe("bottom");
  expect(layerOf("chaqueta_traje")).toBe("outer");
  expect(layerOf("calzado")).toBe("shoes");
  expect(layerOf("complemento")).toBe("accessory");
});

test("todos los GARMENT_TYPES tienen capa", () => {
  for (const t of GARMENT_TYPES) expect(layerOf(t)).toBeTruthy();
});

test("GarmentPatchSchema rechaza formality 6 y availability desconocida", () => {
  expect(GarmentPatchSchema.safeParse({ formality: 6 }).success).toBe(false);
  expect(GarmentPatchSchema.safeParse({ availability: "prestada" }).success).toBe(false);
});

test("GarmentPatchSchema acepta un cambio de disponibilidad y rechaza campos desconocidos", () => {
  expect(GarmentPatchSchema.safeParse({ availability: "lavanderia" }).success).toBe(true);
  expect(GarmentPatchSchema.safeParse({ status: "ready" }).success).toBe(false);
});

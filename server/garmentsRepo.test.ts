// @vitest-environment node
import { garmentPatchToRow, rowToGarment } from "./garmentsRepo.js";

test("garmentPatchToRow mapea a snake_case", () => {
  expect(garmentPatchToRow({ suitPairId: "a", jacketCombinable: true })).toEqual({ suit_pair_id: "a", jacket_combinable: true });
});

test("garmentPatchToRow solo incluye los campos presentes", () => {
  expect(garmentPatchToRow({ availability: "guardada" })).toEqual({ availability: "guardada" });
});

test("rowToGarment mapea a camelCase y añade imageUrl", () => {
  const g = rowToGarment(
    {
      id: "g1", user_id: "u", status: "ready", image_path: "u/g1.webp", type: "camisa", description: "camisa oxford azul",
      colors: ["azul"], formality: 3, seasons: ["primavera"], pattern: null, material: "algodón",
      availability: "disponible", suit_pair_id: null, jacket_combinable: false, error: null,
      created_at: "2026-11-06T10:00:00Z", updated_at: "2026-11-06T10:00:00Z",
    },
    "https://signed/url",
  );
  expect(g).toEqual({
    id: "g1", status: "ready", type: "camisa", description: "camisa oxford azul", colors: ["azul"], formality: 3,
    seasons: ["primavera"], pattern: null, material: "algodón", availability: "disponible", suitPairId: null,
    jacketCombinable: false, error: null, imageUrl: "https://signed/url", createdAt: "2026-11-06T10:00:00Z",
  });
});

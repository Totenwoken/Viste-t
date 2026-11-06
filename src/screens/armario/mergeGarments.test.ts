import { mergeGarments } from "./mergeGarments";
import { garment } from "./testData";

test("conserva la imageUrl de las prendas ya conocidas y usa la nueva para las nuevas", () => {
  const prev = [garment({ id: "a", imageUrl: "https://old/a" })];
  const next = [garment({ id: "a", imageUrl: "https://new/a", formality: 4 }), garment({ id: "b", imageUrl: "https://new/b" })];
  const merged = mergeGarments(prev, next, true);
  expect(merged.map((g) => g.imageUrl)).toEqual(["https://old/a", "https://new/b"]);
  expect(merged[0].formality).toBe(4);
});

test("con keepUrls=false usa todas las URL nuevas (las antiguas caducan)", () => {
  const prev = [garment({ id: "a", imageUrl: "https://old/a" })];
  const next = [garment({ id: "a", imageUrl: "https://new/a" })];
  expect(mergeGarments(prev, next, false)[0].imageUrl).toBe("https://new/a");
});

test("sin lista previa devuelve la nueva", () => {
  const next = [garment({ id: "a" })];
  expect(mergeGarments(null, next, true)).toBe(next);
});

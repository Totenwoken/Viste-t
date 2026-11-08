import { generateOutfit, OutfitError, rejectOutfit, wearOther, wearOutfit } from "./outfitsApi";
import { setAccessCode } from "./api";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  setAccessCode("c");
  fetchMock = vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify({ outfit: { id: "o1" }, garments: [] })));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const call = (i = 0) => fetchMock.mock.calls[i] as [string, RequestInit];

test("generateOutfit hace POST con el cuerpo y devuelve el conjunto", async () => {
  const r = await generateOutfit({ mode: "auto", lockedIds: ["a"] });
  expect(r.outfit.id).toBe("o1");
  expect(call()[0]).toBe("/api/outfits/generate");
  expect(JSON.parse(String(call()[1].body))).toEqual({ mode: "auto", lockedIds: ["a"] });
});

test("generateOutfit con 422 lanza OutfitError con el tipo y el mensaje del servidor", async () => {
  fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: "not_enough", message: "No tienes vaqueros disponibles" }), { status: 422 }));
  const err = await generateOutfit({ mode: "vaqueros" }).catch((e) => e);
  expect(err).toBeInstanceOf(OutfitError);
  expect(err).toMatchObject({ kind: "not_enough", message: "No tienes vaqueros disponibles" });
});

test("wearOutfit, rejectOutfit y wearOther llaman a su endpoint", async () => {
  await wearOutfit("o1");
  await rejectOutfit("o1", "colores");
  await rejectOutfit("o2");
  await wearOther(["a", "b"]);
  expect(fetchMock.mock.calls.map((c) => [c[0], JSON.parse(String((c[1] as RequestInit).body))])).toEqual([
    ["/api/outfits/wear", { outfitId: "o1" }],
    ["/api/outfits/feedback", { outfitId: "o1", reason: "colores" }],
    ["/api/outfits/feedback", { outfitId: "o2" }],
    ["/api/outfits/wear-other", { garmentIds: ["a", "b"] }],
  ]);
});

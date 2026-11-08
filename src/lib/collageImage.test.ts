import { collageLayout, shareOrDownload } from "./collageImage";
import type { Garment, GarmentType } from "../../shared/garment";

const g = (id: string, type: GarmentType): Garment => ({
  id, status: "ready", type, description: id, colors: [], formality: 3, seasons: [], pattern: null, material: null,
  availability: "disponible", suitPairId: null, jacketCombinable: false, error: null, createdAt: "", imageUrl: `https://img/${id}`,
});

type Slot = { x: number; y: number; w: number; h: number };
const overlap = (a: Slot, b: Slot) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function checkLayout(garments: Garment[]) {
  const l = collageLayout(garments);
  expect(l).toMatchObject({ w: 1080, h: 1350 });
  expect(l.slots.map((s) => s.id).sort()).toEqual(garments.map((x) => x.id).sort());
  for (const s of l.slots) {
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.x + s.w).toBeLessThanOrEqual(1080);
    expect(s.y + s.h).toBeLessThanOrEqual(1350);
    expect(s.w).toBeGreaterThan(0);
    expect(s.h).toBeGreaterThan(0);
  }
  for (let i = 0; i < l.slots.length; i++) for (let j = i + 1; j < l.slots.length; j++) expect(overlap(l.slots[i], l.slots[j])).toBe(false);
  return l;
}

test("collageLayout coloca arriba, abajo y calzado sin solaparse y dentro del lienzo", () => {
  const l = checkLayout([g("c", "camisa"), g("p", "pantalon_chino"), g("z", "calzado")]);
  const by = Object.fromEntries(l.slots.map((s) => [s.id, s]));
  expect(by.c.x).toBeLessThan(by.p.x); // arriba a la izquierda, pantalón a la derecha
  expect(by.z.y).toBeGreaterThan(by.c.y + by.c.h - 1); // calzado abajo
});

test("con abrigo y jersey reparte la columna izquierda", () => {
  const l = checkLayout([g("sc", "sobrecamisa"), g("j", "jersey"), g("cam", "camiseta"), g("v", "pantalon_vaquero"), g("z", "calzado")]);
  const by = Object.fromEntries(l.slots.map((s) => [s.id, s]));
  expect(by.sc.y).toBeLessThan(by.j.y);
  expect(by.sc.x).toBe(by.j.x);
});

test("shareOrDownload usa navigator.share cuando canShare acepta archivos", async () => {
  const share = vi.fn(async () => {});
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  await shareOrDownload(new Blob(["x"], { type: "image/png" }));
  expect(share).toHaveBeenCalledWith({ files: [expect.any(File)] });
  const file = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0];
  expect(file.name).toBe("conjunto.png");
});

test("shareOrDownload descarga con un enlace si no se puede compartir", async () => {
  Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  await shareOrDownload(new Blob(["x"], { type: "image/png" }), "mi-conjunto.png");
  expect(click).toHaveBeenCalled();
  click.mockRestore();
});

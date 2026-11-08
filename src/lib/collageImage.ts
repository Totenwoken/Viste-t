import type { Garment } from "../../shared/garment";
import { collageSlots } from "../screens/outfit/OutfitCollage";

export interface Slot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 40;
const GAP = 24;

/** Misma disposición que el collage en pantalla, en un lienzo 4:5 (1080×1350). */
export function collageLayout(garments: Garment[], width = 1080): { w: number; h: number; slots: Slot[] } {
  const h = Math.round((width * 5) / 4);
  const { outer, upper, bottom, shoes } = collageSlots(garments);
  const colW = (width - PAD * 2 - GAP) / 2;
  const shoesH = Math.round(h * 0.22);
  const topH = h - PAD * 2 - GAP - shoesH;
  const slots: Slot[] = [];

  const stack = (items: Garment[], x: number) => {
    const n = items.length;
    const each = (topH - GAP * (n - 1)) / n;
    items.forEach((g, i) => slots.push({ id: g.id, x, y: PAD + i * (each + GAP), w: colW, h: each }));
  };
  if (outer.length + upper.length) stack([...outer, ...upper], PAD);
  if (bottom.length) stack(bottom, PAD + colW + GAP);

  if (shoes.length) {
    const shoesW = Math.min(width - PAD * 2, colW * 1.2);
    const each = (shoesW - GAP * (shoes.length - 1)) / shoes.length;
    const x0 = (width - shoesW) / 2;
    shoes.forEach((g, i) => slots.push({ id: g.id, x: x0 + i * (each + GAP), y: h - PAD - shoesH, w: each, h: shoesH }));
  }
  return { w: width, h, slots };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se ha podido cargar una foto"));
    img.src = url;
  });
}

/** Dibuja el conjunto en un PNG (fondo claro, fotos sin deformar). */
export async function renderCollage(garments: Garment[]): Promise<Blob> {
  const layout = collageLayout(garments);
  const canvas = document.createElement("canvas");
  canvas.width = layout.w;
  canvas.height = layout.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se puede crear la imagen");
  ctx.fillStyle = "#ece8e1";
  ctx.fillRect(0, 0, layout.w, layout.h);

  const byId = new Map(garments.map((g) => [g.id, g]));
  // Se cargan todas a la vez para que la imagen esté lista cuanto antes.
  const images = await Promise.all(layout.slots.map((s) => {
    const url = byId.get(s.id)?.imageUrl;
    return url ? loadImage(url) : Promise.resolve(null);
  }));
  for (const [i, s] of layout.slots.entries()) {
    const img = images[i];
    if (!img) continue;
    const scale = Math.min(s.w / img.width, s.h / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, s.x + (s.w - w) / 2, s.y + (s.h - h) / 2, w, h);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se puede crear la imagen");
  return blob;
}

/** En el iPhone abre "Compartir" (Guardar imagen, WhatsApp…); si no se puede, descarga el archivo. */
export async function shareOrDownload(blob: Blob, filename = "conjunto.png"): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

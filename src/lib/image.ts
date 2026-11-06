export class ImageDecodeError extends Error {
  constructor() {
    super("No se puede leer esta foto");
    this.name = "ImageDecodeError";
  }
}

/** Tamaño que cabe en un cuadrado de `max` píxeles sin ampliar nunca. */
export function fitWithin(w: number, h: number, max = 1024): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/** Reduce la foto a lado máximo `max` y la recodifica como JPEG 0,85. */
export async function compressImage(file: Blob, max = 1024): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageDecodeError();
  }
  const { w, h } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageDecodeError();
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new ImageDecodeError();
  return blob;
}

/** Quita el fondo en el propio móvil. El modelo se descarga la primera vez que se usa. */
export async function removeBackground(img: Blob): Promise<Blob> {
  const { removeBackground: run } = await import("@imgly/background-removal");
  return run(img, { output: { format: "image/webp", quality: 0.85 } });
}

export async function prepareGarmentImage(file: Blob): Promise<Blob> {
  return removeBackground(await compressImage(file));
}

export async function uploadToSignedUrl(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": blob.type || "image/webp" },
    body: blob,
  });
  if (!res.ok) throw new Error(`Subida fallida (${res.status})`);
}

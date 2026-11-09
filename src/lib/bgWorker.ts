/// <reference lib="webworker" />
// Web Worker: quita el fondo sin bloquear la pantalla.
import { removeBackground } from "@imgly/background-removal";

self.onmessage = async (e: MessageEvent<{ id: number; blob: Blob }>) => {
  const { id, blob } = e.data;
  try {
    const out = await removeBackground(blob, {
      // Modelo pequeño: la mitad de tamaño y de memoria que el de por defecto; suficiente para prendas.
      model: "isnet_quint8",
      output: { format: "image/webp", quality: 0.85 },
    });
    (self as unknown as Worker).postMessage({ id, blob: out });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

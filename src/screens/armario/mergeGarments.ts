import type { Garment } from "../../../shared/garment";

/**
 * Combina una lista recién cargada con la anterior conservando las URL de imagen ya conocidas,
 * para que el navegador no vuelva a descargar (ni parpadeen) las fotos en cada recarga.
 * Con keepUrls=false se usan todas las nuevas (las URL firmadas caducan a la hora).
 */
export function mergeGarments(prev: Garment[] | null, next: Garment[], keepUrls: boolean): Garment[] {
  if (!prev || !keepUrls) return next;
  const known = new Map(prev.map((g) => [g.id, g.imageUrl]));
  return next.map((g) => {
    const url = known.get(g.id);
    return url ? { ...g, imageUrl: url } : g;
  });
}

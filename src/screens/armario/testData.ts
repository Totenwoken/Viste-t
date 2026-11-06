import type { Garment } from "../../../shared/garment";

export function garment(over: Partial<Garment> = {}): Garment {
  return {
    id: "g1", status: "ready", type: "camisa", description: "camisa oxford azul", colors: ["azul"], formality: 3,
    seasons: ["primavera"], pattern: null, material: null, availability: "disponible", suitPairId: null,
    jacketCombinable: false, error: null, imageUrl: "https://img/g1", createdAt: "2026-11-06T10:00:00Z",
    ...over,
  };
}

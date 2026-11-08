import { layerOf, type Garment, type GarmentType, type Layer } from "./garment.js";

export const OUTFIT_MODES = ["auto", "vaqueros", "formal", "traje", "chinos"] as const;
export type OutfitMode = (typeof OUTFIT_MODES)[number];

export const REJECT_REASONS = ["muy formal", "muy informal", "colores", "me lo puse hace poco", "no me apetece esa prenda"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export interface Outfit {
  id: string;
  mode: OutfitMode | "manual";
  request: string | null;
  garmentIds: string[];
  lockedIds: string[];
  explanation: string;
  status: "proposed" | "worn" | "rejected";
  rejectReason: RejectReason | null;
  wornOn: string | null;
  createdAt: string;
  /** Avisos para la pantalla (no se guardan en la BD). */
  notes: string[];
  /** Prenda añadida con "Añadir capa" (no se guarda en la BD). */
  addedId?: string | null;
}

export interface OutfitRules {
  mode: OutfitMode;
  lockedIds: string[];
}

export interface Weather {
  tempC: number;
  minC: number;
  maxC: number;
  rainProb: number;
  label: string;
  icon: string;
  /** Temperatura a las 8:00 y a las 21:00 (null si no se conoce). */
  morningC?: number | null;
  eveningC?: number | null;
}

const DRESS_TROUSERS: GarmentType[] = ["pantalon_traje", "pantalon_otro"];
const FORMAL_BOTTOMS: GarmentType[] = ["pantalon_traje", "pantalon_otro", "pantalon_chino"];
const FORMAL_OUTERS: GarmentType[] = ["americana", "chaqueta_traje", "abrigo"];

/** Prendas que pueden entrar en un conjunto: listas, disponibles y que no sean complementos. */
export function usable(garments: Garment[]): Garment[] {
  return garments.filter((g) => g.status === "ready" && g.availability === "disponible" && g.type && g.type !== "complemento");
}

const name = (g: Garment | undefined, id: string) => g?.description ?? id;

export function validateOutfit(
  ids: string[],
  available: Garment[],
  rules: OutfitRules,
): { ok: true } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const pool = new Map(usable(available).map((g) => [g.id, g]));
  const all = new Map(available.map((g) => [g.id, g]));

  if (new Set(ids).size !== ids.length) problems.push("hay prendas repetidas");

  const chosen: Garment[] = [];
  for (const id of ids) {
    const g = pool.get(id);
    if (g) chosen.push(g);
    else if (all.get(id)?.type === "complemento") problems.push("no se proponen complementos");
    else problems.push(`la prenda ${name(all.get(id), id)} no está disponible`);
  }

  const by = (layer: Layer) => chosen.filter((g) => layerOf(g.type!) === layer);
  const top = by("top"), mid = by("mid"), bottom = by("bottom"), shoes = by("shoes"), outer = by("outer");

  if (bottom.length === 0) problems.push("falta una prenda de abajo");
  if (bottom.length > 1) problems.push(`hay ${bottom.length} prendas de abajo`);
  if (shoes.length === 0) problems.push("falta calzado");
  if (shoes.length > 1) problems.push(`hay ${shoes.length} calzados`);
  if (top.length + mid.length === 0) problems.push("falta una prenda de arriba o un jersey");
  if (top.length > 1) problems.push(`hay ${top.length} prendas de arriba`);
  if (mid.length > 1) problems.push(`hay ${mid.length} jerséis`);
  if (outer.length > 1) problems.push(`hay ${outer.length} prendas de fuera`);

  for (const id of rules.lockedIds) {
    if (!ids.includes(id)) problems.push(`falta la prenda bloqueada ${name(all.get(id), id)}`);
  }

  for (const jacket of chosen.filter((g) => g.type === "chaqueta_traje" && !g.jacketCombinable)) {
    if (!bottom.some((b) => b.id === jacket.suitPairId)) {
      problems.push(`la chaqueta de traje ${name(jacket, jacket.id)} solo puede ir con su pantalón`);
    }
  }

  const bottomType = bottom[0]?.type;
  const topTypes = top.map((g) => g.type);
  const midTypes = mid.map((g) => g.type);
  switch (rules.mode) {
    case "vaqueros":
      if (bottomType && bottomType !== "pantalon_vaquero") problems.push("en vaqueros el pantalón debe ser vaquero");
      break;
    case "chinos":
      if (bottomType && bottomType !== "pantalon_chino") problems.push("en chinos el pantalón debe ser chino");
      break;
    case "formal":
      if (bottomType && !FORMAL_BOTTOMS.includes(bottomType)) problems.push("en formal el pantalón debe ser de vestir o chino");
      if (topTypes.some((t) => t !== "camisa") || midTypes.some((t) => t !== "jersey")) {
        problems.push("en formal arriba va camisa o jersey");
      }
      if (outer.some((g) => !FORMAL_OUTERS.includes(g.type!))) problems.push("en formal la prenda de fuera debe ser americana o abrigo");
      break;
    case "traje": {
      const jacket = outer.find((g) => g.type === "americana" || g.type === "chaqueta_traje");
      if (!jacket) problems.push("en formal traje hace falta un traje o una americana");
      if (bottomType && !DRESS_TROUSERS.includes(bottomType)) problems.push("en formal traje el pantalón debe ser de vestir");
      if (topTypes.some((t) => t !== "camisa") || midTypes.some((t) => t !== "jersey")) {
        problems.push("en formal traje arriba va camisa o cuello alto");
      }
      break;
    }
    case "auto":
      break;
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

export function missingForMode(available: Garment[], mode: OutfitMode): string | null {
  const pool = usable(available);
  const has = (...types: GarmentType[]) => pool.some((g) => types.includes(g.type!));
  const hasLayer = (layer: Layer) => pool.some((g) => layerOf(g.type!) === layer);

  if (!(hasLayer("top") || hasLayer("mid")) || !hasLayer("bottom") || !hasLayer("shoes")) {
    return "Necesitas al menos una prenda de arriba o un jersey, una de abajo y calzado disponibles";
  }
  switch (mode) {
    case "vaqueros":
      return has("pantalon_vaquero") ? null : "No tienes vaqueros disponibles";
    case "chinos":
      return has("pantalon_chino") ? null : "No tienes chinos disponibles";
    case "formal":
      return has("camisa", "jersey") && has(...FORMAL_BOTTOMS)
        ? null
        : "Necesitas una camisa o un jersey y un pantalón de vestir o chino disponibles";
    case "traje": {
      const suit = pool.some((g) => g.type === "chaqueta_traje" && pool.some((p) => p.id === g.suitPairId));
      const blazer = has("americana") && has(...DRESS_TROUSERS);
      return (suit || blazer) && has("camisa", "jersey") ? null : "Necesitas un traje vinculado o una americana con pantalón de vestir";
    }
    case "auto":
      return null;
  }
}

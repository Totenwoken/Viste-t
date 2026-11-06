import type { Garment, GarmentPatch } from "../shared/garment";

export interface GarmentRow {
  id: string;
  user_id: string;
  status: Garment["status"];
  image_path: string | null;
  type: Garment["type"];
  description: string | null;
  colors: string[];
  formality: number | null;
  seasons: Garment["seasons"];
  pattern: string | null;
  material: string | null;
  availability: Garment["availability"];
  suit_pair_id: string | null;
  jacket_combinable: boolean;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToGarment(row: GarmentRow, imageUrl?: string): Garment {
  const g: Garment = {
    id: row.id,
    status: row.status,
    type: row.type,
    description: row.description,
    colors: row.colors ?? [],
    formality: row.formality,
    seasons: row.seasons ?? [],
    pattern: row.pattern,
    material: row.material,
    availability: row.availability,
    suitPairId: row.suit_pair_id,
    jacketCombinable: row.jacket_combinable,
    error: row.error,
    createdAt: row.created_at,
  };
  if (imageUrl !== undefined) g.imageUrl = imageUrl;
  return g;
}

const COLUMN: Record<keyof GarmentPatch, keyof GarmentRow> = {
  type: "type",
  description: "description",
  colors: "colors",
  formality: "formality",
  seasons: "seasons",
  pattern: "pattern",
  material: "material",
  availability: "availability",
  suitPairId: "suit_pair_id",
  jacketCombinable: "jacket_combinable",
};

export function garmentPatchToRow(p: GarmentPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) out[COLUMN[k as keyof GarmentPatch]] = v;
  }
  return out;
}

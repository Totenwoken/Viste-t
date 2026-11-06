import { z } from "zod";

export const GARMENT_TYPES = [
  "camiseta", "camisa", "polo", "jersey", "sudadera", "sobrecamisa",
  "pantalon_vaquero", "pantalon_chino", "pantalon_traje", "pantalon_otro", "bermuda",
  "abrigo", "cazadora", "americana", "chaqueta_traje",
  "calzado", "complemento",
] as const;
export type GarmentType = (typeof GARMENT_TYPES)[number];

export type Layer = "top" | "mid" | "bottom" | "outer" | "shoes" | "accessory";

const LAYER: Record<GarmentType, Layer> = {
  camiseta: "top", camisa: "top", polo: "top",
  jersey: "mid", sudadera: "mid", sobrecamisa: "mid",
  pantalon_vaquero: "bottom", pantalon_chino: "bottom", pantalon_traje: "bottom", pantalon_otro: "bottom", bermuda: "bottom",
  abrigo: "outer", cazadora: "outer", americana: "outer", chaqueta_traje: "outer",
  calzado: "shoes",
  complemento: "accessory",
};

export function layerOf(t: GarmentType): Layer {
  return LAYER[t];
}

export const SEASONS = ["primavera", "verano", "otono", "invierno"] as const;
export type Season = (typeof SEASONS)[number];

export const AVAILABILITY = ["disponible", "lavanderia", "guardada"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const GARMENT_STATUS = ["pending", "ready", "error"] as const;
export type GarmentStatus = (typeof GARMENT_STATUS)[number];

export interface Garment {
  id: string;
  status: GarmentStatus;
  type: GarmentType | null;
  description: string | null;
  colors: string[];
  /** 1 = deporte/casa … 5 = traje/ceremonia */
  formality: number | null;
  seasons: Season[];
  pattern: string | null;
  material: string | null;
  availability: Availability;
  suitPairId: string | null;
  jacketCombinable: boolean;
  error: string | null;
  imageUrl?: string;
  createdAt: string;
}

export const GarmentPatchSchema = z
  .object({
    type: z.enum(GARMENT_TYPES),
    description: z.string().trim().min(1).max(80),
    colors: z.array(z.string().trim().min(1)).max(5),
    formality: z.number().int().min(1).max(5),
    seasons: z.array(z.enum(SEASONS)),
    pattern: z.string().trim().max(40).nullable(),
    material: z.string().trim().max(40).nullable(),
    availability: z.enum(AVAILABILITY),
    suitPairId: z.string().uuid().nullable(),
    jacketCombinable: z.boolean(),
  })
  .partial()
  .strict();
export type GarmentPatch = z.infer<typeof GarmentPatchSchema>;

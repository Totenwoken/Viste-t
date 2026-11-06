import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GARMENT_TYPES, SEASONS } from "../shared/garment.js";

/** Lo que le pedimos a Claude: sin restricciones numéricas para que el formato estructurado sea simple. */
const TaggingOutputSchema = z.object({
  is_garment: z.boolean().describe("false si la foto no muestra una prenda, calzado o complemento"),
  type: z.enum(GARMENT_TYPES),
  description: z.string().describe("Descripción corta en español, p. ej. 'camisa oxford azul claro'"),
  colors: z.array(z.string()).describe("De 1 a 3 colores principales, en español"),
  formality: z.number().int().describe("1 a 5"),
  seasons: z.array(z.enum(SEASONS)),
  pattern: z.string().nullable().describe("Estampado (rayas, cuadros, liso...) o null"),
  material: z.string().nullable().describe("Material aparente o null"),
});

/** Validación estricta de lo que devuelve Claude antes de guardarlo. */
export const TaggingSchema = TaggingOutputSchema.extend({
  description: z.string().trim().min(1).max(80),
  colors: z.array(z.string().trim().min(1)).min(1).max(3),
  formality: z.number().int().min(1).max(5),
  seasons: z.array(z.enum(SEASONS)).min(1),
});
export type Tags = z.infer<typeof TaggingSchema>;

export const TAGGING_SYSTEM = `Eres un experto en moda masculina que cataloga el armario de una persona a partir de fotos de sus prendas.
Para cada foto rellena la ficha de la prenda principal que aparece.
- type: el tipo que mejor encaje. Las americanas sueltas son "americana"; la chaqueta de un traje es "chaqueta_traje".
- description: corta y concreta, en español (tipo + rasgo + color), máximo 60 caracteres.
- colors: de 1 a 3 colores principales en español ("azul marino", "beige", "blanco roto"...).
- formality, escala de 1 a 5: 1 = deporte/casa, 2 = informal, 3 = smart casual, 4 = formal de oficina, 5 = traje/ceremonia.
- seasons: estaciones en las que se puede llevar (primavera, verano, otono, invierno).
- pattern y material: si se aprecian; si no, null.
Si la foto no muestra una prenda, calzado o complemento, pon is_garment = false y rellena el resto con valores cualesquiera.`;

export type TaggingMediaType = "image/webp" | "image/png" | "image/jpeg";

export function buildTaggingRequest(imageBase64: string, mediaType: TaggingMediaType, model: string) {
  return {
    model,
    max_tokens: 2000,
    system: TAGGING_SYSTEM,
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: imageBase64 } },
          { type: "text" as const, text: "Rellena la ficha de esta prenda." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(TaggingOutputSchema), effort: "low" as const },
  };
}

export type TaggingResult = { ok: true; tags: Tags } | { ok: false; error: string };

export function interpretTagging(resp: { stop_reason: string | null; parsed_output: unknown }): TaggingResult {
  if (resp.stop_reason === "refusal") return { ok: false, error: "Claude no ha podido analizar esta foto" };
  if (resp.stop_reason !== "end_turn" || resp.parsed_output == null) return { ok: false, error: "Respuesta no válida" };
  const parsed = TaggingSchema.safeParse(resp.parsed_output);
  if (!parsed.success) return { ok: false, error: "Respuesta no válida" };
  if (!parsed.data.is_garment) return { ok: false, error: "No parece una prenda" };
  return { ok: true, tags: parsed.data };
}

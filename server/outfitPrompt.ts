import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Garment } from "../shared/garment.js";
import type { OutfitMode, Weather } from "../shared/outfit.js";
import { DEFAULT_STYLE_PROFILE } from "../shared/styleProfile.js";

export interface HistoryItem {
  garmentIds: string[];
  status: "worn" | "rejected";
  rejectReason: string | null;
  date: string;
}

export interface OutfitContext {
  today: string;
  weather: Weather | null;
  mode: OutfitMode;
  request: string | null;
  lockedIds: string[];
  excludedIds: string[];
  wornRecently: string[];
  history: HistoryItem[];
  retryProblems?: string[];
  /** Conjunto al que sustituye "Otro": hay que proponer uno distinto. */
  previousIds?: string[];
}

export const OutfitOutputSchema = z.object({
  garment_ids: z.array(z.string()).describe("ids exactos de las prendas del conjunto, sacados del armario"),
  explanation: z.string().describe("Por qué combina, en español, segunda persona, máximo 200 caracteres"),
  requested_ids: z.array(z.string()).describe("ids de las prendas que corresponden a lo que pidió en 'Quiero ponerme'; vacío si no pidió nada"),
  missing_request: z.string().nullable().describe("la parte de lo pedido que no existe en el armario, o null"),
});
export type OutfitOutput = z.infer<typeof OutfitOutputSchema>;

const MODE_LABEL: Record<OutfitMode, string> = {
  auto: "Automático (elige tú el estilo que mejor encaje con el día)",
  vaqueros: "Vaqueros",
  formal: "Formal",
  traje: "Formal traje",
  chinos: "Chinos",
};

const RULES = `Eres el estilista personal de Alejandro. Montas conjuntos usando EXCLUSIVAMENTE las prendas de su armario (lista de abajo), citándolas por su id exacto.

Composición obligatoria:
- Exactamente 1 prenda de abajo (pantalón o bermuda) y 1 calzado.
- Al menos una prenda de torso: una de arriba (camiseta, camisa, polo) y/o un jersey o sudadera. Un jersey puede ir solo o con una camiseta debajo que no se vea.
- Como máximo 1 prenda de arriba, 1 jersey/sudadera y 1 prenda de fuera (sobrecamisa, cazadora, americana, abrigo, chaqueta de traje). La sobrecamisa cuenta como prenda de fuera.
- Nunca complementos: solo ropa y calzado.

Estilos:
- Vaqueros: pantalón vaquero; arriba camiseta, camisa o polo; jersey opcional.
- Chinos: pantalón chino; arriba camisa, camiseta o polo; jersey opcional.
- Formal: camisa y/o jersey (sin camiseta, sudadera ni polo); pantalón de vestir, de traje suelto o chino (nunca vaqueros ni bermuda); fuera opcional y solo americana o abrigo; calzado de vestir.
- Formal traje: traje completo (chaqueta de traje + su pantalón) o americana + pantalón de vestir; camisa o jersey de cuello alto; calzado de vestir.
- Automático: elige el estilo que mejor encaje con el día y con su gusto.
- Una chaqueta de traje solo va con su propio pantalón, salvo que su ficha diga que se puede usar suelta.

Criterio:
- Respeta su perfil de estilo (abajo): paleta, contraste, prendas favoritas.
- Incluye SIEMPRE las prendas bloqueadas. No uses las excluidas.
- No repitas prendas puestas en los últimos 7 días salvo que estén bloqueadas o las haya pedido.
- Evita combinaciones que ha rechazado y ten en cuenta sus motivos (p. ej. "muy formal", "colores").
- Adapta capas y tejidos a la temperatura y a la lluvia si se indican.
- Si pide algo en "Quiero ponerme", usa las prendas de su armario que mejor encajen con lo pedido y devuélvelas en requested_ids. Si alguna parte no existe en su armario, ponla en missing_request y monta igualmente el mejor conjunto posible.
- explanation: una o dos frases, en español y en segunda persona, sobre por qué combina.`;

const FIELD = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "-" : String(v));

export function wardrobeBlock(garments: Garment[]): string {
  return [...garments]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((g) => [g.id, g.type, g.description, g.colors.join(", "), g.formality, g.seasons.join(", ")]
      .concat(g.suitPairId ? [`traje con ${g.suitPairId}${g.jacketCombinable ? ", se puede usar suelta" : ""}`] : [])
      .map(FIELD)
      .join(" | "))
    .join("\n");
}

function describeRequest(ctx: OutfitContext, byId: Map<string, Garment>): string {
  const desc = (id: string) => `${id} (${byId.get(id)?.description ?? "?"})`;
  const lines = [`Fecha: ${ctx.today}`];
  if (ctx.weather) {
    const w = ctx.weather;
    lines.push(`Tiempo: ${w.label}, ahora ${Math.round(w.tempC)} °C (mín ${Math.round(w.minC)} °C, máx ${Math.round(w.maxC)} °C), probabilidad de lluvia ${w.rainProb}%`);
  }
  lines.push(`Estilo pedido: ${MODE_LABEL[ctx.mode]} [${ctx.mode}]`);
  if (ctx.request) lines.push(`Quiero ponerme: ${ctx.request}`);
  if (ctx.lockedIds.length) lines.push(`Prendas bloqueadas (inclúyelas): ${ctx.lockedIds.map(desc).join("; ")}`);
  if (ctx.previousIds?.length) lines.push(`Conjunto anterior (propón uno distinto): ${ctx.previousIds.join(", ")}`);
  if (ctx.excludedIds.length) lines.push(`Prendas excluidas (no las uses): ${ctx.excludedIds.map(desc).join("; ")}`);
  if (ctx.wornRecently.length) lines.push(`Puestas en los últimos 7 días: ${ctx.wornRecently.join(", ")}`);
  if (ctx.history.length) {
    lines.push("Historial reciente:");
    for (const h of ctx.history) {
      const verdict = h.status === "worn" ? "se lo puso" : `rechazado${h.rejectReason ? ` (${h.rejectReason})` : ""}`;
      lines.push(`- ${h.date}: ${h.garmentIds.join(", ")} → ${verdict}`);
    }
  }
  if (ctx.retryProblems?.length) {
    lines.push(`Tu propuesta anterior no era válida por: ${ctx.retryProblems.join("; ")}. Corrígela.`);
  }
  lines.push("Propón un conjunto.");
  return lines.join("\n");
}

export function buildOutfitRequest(garments: Garment[], ctx: OutfitContext, model: string) {
  const byId = new Map(garments.map((g) => [g.id, g]));
  return {
    model,
    max_tokens: 4000,
    system: [
      { type: "text" as const, text: RULES },
      { type: "text" as const, text: `Perfil de estilo:\n${DEFAULT_STYLE_PROFILE}` },
      {
        type: "text" as const,
        text: `Armario (id | tipo | descripción | colores | formalidad 1-5 | estaciones):\n${wardrobeBlock(garments)}`,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user" as const, content: describeRequest(ctx, byId) }],
    output_config: { format: zodOutputFormat(OutfitOutputSchema), effort: "low" as const },
  };
}

export type OutfitInterpretation = { ok: true; out: OutfitOutput } | { ok: false; error: string };

export function interpretOutfit(resp: { stop_reason: string | null; parsed_output: unknown }): OutfitInterpretation {
  if (resp.stop_reason === "refusal") return { ok: false, error: "Claude no ha podido proponer un conjunto" };
  if (resp.stop_reason !== "end_turn" || resp.parsed_output == null) return { ok: false, error: "Respuesta no válida" };
  const parsed = OutfitOutputSchema.safeParse(resp.parsed_output);
  return parsed.success ? { ok: true, out: parsed.data } : { ok: false, error: "Respuesta no válida" };
}

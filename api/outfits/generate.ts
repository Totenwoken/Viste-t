import { z } from "zod";
import { OUTFIT_MODES, missingForMode, validateOutfit, type Weather } from "../../shared/outfit.js";
import { requireAccess } from "../../server/access.js";
import { checkBudget, recordUsage } from "../../server/budget.js";
import { anthropic, modelFor } from "../../server/claude.js";
import { json } from "../../server/http.js";
import { buildOutfitRequest, interpretOutfit, type OutfitContext, type OutfitOutput } from "../../server/outfitPrompt.js";
import {
  loadAvailable, loadHistory, loadOutfit, loadOwnGarments, rowToOutfit, todayMadrid, withImageUrls, type OutfitRow,
} from "../../server/outfitsRepo.js";
import { db, ownerId } from "../../server/supabase.js";

const WeatherSchema = z.object({
  tempC: z.number(), minC: z.number(), maxC: z.number(), rainProb: z.number(), label: z.string(), icon: z.string(),
});

const Body = z.object({
  mode: z.enum(OUTFIT_MODES),
  request: z.string().trim().max(200).optional(),
  lockedIds: z.array(z.string()).max(10).optional(),
  previousOutfitId: z.string().optional(),
  replaceId: z.string().optional(),
  weather: WeatherSchema.nullable().optional(),
});

const INVALID = { error: "invalid_outfit", message: "No he conseguido montar un conjunto válido. Prueba otra vez." };

export async function POST(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid" });
  const body = parsed.data;
  const request = body.request || null;
  const weather: Weather | null = body.weather ?? null;
  const notes: string[] = [];

  const available = await loadAvailable();
  const availableIds = new Set(available.map((g) => g.id));

  // userLocked: lo que el usuario bloqueó (se guarda y se devuelve).
  // pinned: lo que este conjunto debe mantener (en "Cambiar solo esta", todo el anterior menos la prenda a cambiar).
  let userLocked = [...new Set(body.lockedIds ?? [])];
  let pinned = [...userLocked];
  const excludedIds: string[] = [];
  let previousIds: string[] | undefined;
  if (body.previousOutfitId) {
    const previous = await loadOutfit(body.previousOutfitId);
    if (body.replaceId) {
      if (!previous) return json(404, { error: "not_found" });
      pinned = previous.garment_ids.filter((id) => id !== body.replaceId);
      userLocked = userLocked.filter((id) => id !== body.replaceId);
      excludedIds.push(body.replaceId);
    } else if (previous) {
      previousIds = previous.garment_ids;
    }
  }

  const gone = [...new Set([...pinned, ...userLocked])].filter((id) => !availableIds.has(id));
  if (gone.length) {
    const known = new Map((await loadOwnGarments(gone)).map((g) => [g.id, g]));
    for (const id of gone) {
      const g = known.get(id);
      notes.push(g ? `«${g.description ?? "una prenda"}» ya no está disponible y la he quitado` : "Una prenda bloqueada ya no está en tu armario");
    }
    pinned = pinned.filter((id) => availableIds.has(id));
    userLocked = userLocked.filter((id) => availableIds.has(id));
  }

  const pool = available.filter((g) => !excludedIds.includes(g.id));
  const poolIds = new Set(pool.map((g) => g.id));
  const missing = missingForMode(pool, body.mode);
  if (missing) return json(422, { error: "not_enough", message: missing });

  const overBudget = await checkBudget();
  if (overBudget) return overBudget;

  if (body.replaceId && body.previousOutfitId) {
    await db().from("outfit_swaps").insert({ user_id: ownerId(), outfit_id: body.previousOutfitId, garment_id: body.replaceId });
  }

  const today = todayMadrid();
  const { wornRecently, history } = await loadHistory(today);
  const ctx: OutfitContext = { today, weather, mode: body.mode, request, lockedIds: pinned, excludedIds, wornRecently, history, previousIds };
  const model = modelFor("outfit");
  const sameAsPrevious = (ids: string[]) =>
    !!previousIds && ids.length === previousIds.length && ids.every((id) => previousIds!.includes(id));

  let result: OutfitOutput | null = null;
  let retryProblems: string[] | undefined;
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    let interpreted: ReturnType<typeof interpretOutfit>;
    try {
      // El armario completo va en el prompt (system estable para la caché); las excluidas se indican aparte y la validación usa pool.
      const resp = await anthropic().messages.parse(buildOutfitRequest(available, { ...ctx, retryProblems }, model));
      await recordUsage("outfit", model, resp.usage);
      interpreted = interpretOutfit(resp);
    } catch {
      // El SDK lanza si la respuesta no se puede interpretar o si la API falla tras sus reintentos.
      interpreted = { ok: false, error: "Respuesta no válida" };
    }
    if (!interpreted.ok) {
      retryProblems = [interpreted.error];
      continue;
    }
    const out = interpreted.out;
    const requested = out.requested_ids.filter((id) => poolIds.has(id));
    const check = validateOutfit(out.garment_ids, pool, { mode: body.mode, lockedIds: [...pinned, ...requested] });
    const problems = check.ok ? [] : [...check.problems];
    if (sameAsPrevious(out.garment_ids)) problems.push("es el mismo conjunto que el anterior");
    if (problems.length === 0) result = { ...out, requested_ids: requested };
    else retryProblems = problems;
  }
  if (!result) return json(422, INVALID);

  if (result.missing_request) notes.push(`No he encontrado «${result.missing_request}» en tu armario`);
  const finalLocked = [...new Set([...userLocked, ...result.requested_ids])];

  const { data: row, error } = await db()
    .from("outfits")
    .insert({
      user_id: ownerId(),
      mode: body.mode,
      request,
      garment_ids: result.garment_ids,
      locked_ids: finalLocked,
      explanation: result.explanation.slice(0, 300),
      status: "proposed",
      weather,
    })
    .select()
    .single();
  if (error || !row) return json(500, { error: "db", detail: error?.message ?? null });

  const byId = new Map(pool.map((g) => [g.id, g]));
  const garments = await withImageUrls(result.garment_ids.map((id) => byId.get(id)!));
  return json(200, { outfit: rowToOutfit(row as OutfitRow, notes), garments });
}

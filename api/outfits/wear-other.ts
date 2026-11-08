import { z } from "zod";
import { requireAccess } from "../../server/access.js";
import { json } from "../../server/http.js";
import { loadOwnGarments, rowToOutfit, todayMadrid, unwearToday, type OutfitRow } from "../../server/outfitsRepo.js";
import { db, ownerId } from "../../server/supabase.js";

const Body = z.object({ garmentIds: z.array(z.string().min(1)).min(1).max(8) });

/** "Me puse otra cosa": guarda lo que se puso de verdad hoy. */
export async function POST(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "invalid" });

  const ids = [...new Set(body.data.garmentIds)];
  const own = await loadOwnGarments(ids);
  if (own.length !== ids.length) return json(400, { error: "unknown_garment" });

  const today = todayMadrid();
  await unwearToday(today);
  const { data, error } = await db()
    .from("outfits")
    .insert({ user_id: ownerId(), mode: "manual", request: null, garment_ids: ids, locked_ids: [], explanation: "", status: "worn", worn_on: today })
    .select()
    .single();
  if (error || !data) return json(500, { error: "db", detail: error?.message ?? null });
  return json(201, { outfit: rowToOutfit(data as OutfitRow) });
}

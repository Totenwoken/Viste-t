import { z } from "zod";
import { REJECT_REASONS } from "../../shared/outfit.js";
import { requireAccess } from "../../server/access.js";
import { json } from "../../server/http.js";
import { loadOutfit, rowToOutfit, type OutfitRow } from "../../server/outfitsRepo.js";
import { db, ownerId } from "../../server/supabase.js";

const Body = z.object({ outfitId: z.string().min(1), reason: z.enum(REJECT_REASONS).optional() });

/** "Otro": registra que el conjunto no convenció, con su motivo si lo hay. */
export async function POST(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "invalid" });

  const current = await loadOutfit(body.data.outfitId);
  if (!current) return json(404, { error: "not_found" });
  if (current.status === "worn") return json(409, { error: "already_worn" });

  const { data, error } = await db()
    .from("outfits")
    .update({ status: "rejected", reject_reason: body.data.reason ?? null })
    .eq("id", current.id)
    .eq("user_id", ownerId())
    .select()
    .single();
  if (error || !data) return json(500, { error: "db", detail: error?.message ?? null });
  return json(200, { outfit: rowToOutfit(data as OutfitRow) });
}

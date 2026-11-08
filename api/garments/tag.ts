import { z } from "zod";
import { requireAccess } from "../../server/access.js";
import { checkBudget, recordUsage } from "../../server/budget.js";
import { anthropic, modelFor } from "../../server/claude.js";
import { rowToGarment, type GarmentRow } from "../../server/garmentsRepo.js";
import { json } from "../../server/http.js";
import { BUCKET, db, ownerId } from "../../server/supabase.js";
import { buildTaggingRequest, interpretTagging, type TaggingMediaType } from "../../server/tagging.js";

const Body = z.object({ garmentId: z.string().min(1) });

async function respond(row: GarmentRow): Promise<Response> {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(row.image_path ?? "", 3600);
  return json(200, { garment: rowToGarment(row, data?.signedUrl) });
}

async function save(id: string, patch: Record<string, unknown>): Promise<GarmentRow> {
  const { data, error } = await db()
    .from("garments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId())
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as GarmentRow;
}

export async function POST(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "invalid" });
  const { garmentId } = body.data;

  const { data: row, error } = await db()
    .from("garments")
    .select("*")
    .eq("id", garmentId)
    .eq("user_id", ownerId())
    .maybeSingle();
  if (error) return json(500, { error: "db" });
  if (!row) return json(404, { error: "not_found" });
  if ((row as GarmentRow).status === "ready") return respond(row as GarmentRow); // idempotente

  const overBudget = await checkBudget();
  if (overBudget) return overBudget;

  const file = await db().storage.from(BUCKET).download((row as GarmentRow).image_path ?? "");
  if (file.error || !file.data) return json(409, { error: "image_missing", detail: file.error?.message ?? null });
  const base64 = Buffer.from(await file.data.arrayBuffer()).toString("base64");
  const mediaType = (file.data.type || "image/webp") as TaggingMediaType;

  const model = modelFor("tagging");
  let updated: GarmentRow;
  try {
    const resp = await anthropic().messages.parse(buildTaggingRequest(base64, mediaType, model));
    await recordUsage("tagging", model, resp.usage);
    const result = interpretTagging(resp);
    if (result.ok) {
      const { is_garment: _ignored, ...tags } = result.tags;
      updated = await save(garmentId, { ...tags, status: "ready", error: null });
    } else {
      updated = await save(garmentId, { status: "error", error: result.error });
    }
  } catch {
    updated = await save(garmentId, { status: "error", error: "No se ha podido analizar. Reintenta." });
  }
  return respond(updated);
}

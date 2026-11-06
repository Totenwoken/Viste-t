import { GarmentPatchSchema } from "../../shared/garment";
import { requireAccess } from "../../server/access";
import { garmentPatchToRow, rowToGarment, type GarmentRow } from "../../server/garmentsRepo";
import { json } from "../../server/http";
import { BUCKET, db, ownerId } from "../../server/supabase";

const SIGNED_URL_TTL = 3600;

async function findOwn(id: string): Promise<GarmentRow | null> {
  const { data } = await db().from("garments").select("*").eq("id", id).eq("user_id", ownerId()).maybeSingle();
  return (data as GarmentRow | null) ?? null;
}

async function setPair(id: string, pairId: string | null): Promise<void> {
  await db().from("garments").update({ suit_pair_id: pairId, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", ownerId());
}

async function withImageUrl(row: GarmentRow): Promise<Response> {
  const { data } = await db().storage.from(BUCKET).createSignedUrl(row.image_path ?? "", SIGNED_URL_TTL);
  return json(200, { garment: rowToGarment(row, data?.signedUrl) });
}

export async function GET(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;

  const { data, error } = await db().from("garments").select("*").eq("user_id", ownerId()).order("created_at", { ascending: false });
  if (error) return json(500, { error: "db" });
  const rows = (data ?? []) as GarmentRow[];

  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const signed = await db().storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed.data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return json(200, { garments: rows.map((r) => rowToGarment(r, r.image_path ? urls.get(r.image_path) : undefined)) });
}

export async function PATCH(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json(400, { error: "invalid" });
  const parsed = GarmentPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid", issues: parsed.error.issues });

  const current = await findOwn(id);
  if (!current) return json(404, { error: "not_found" });

  const patch = parsed.data;
  if (patch.suitPairId !== undefined) {
    const newPair = patch.suitPairId;
    if (newPair !== null && (newPair === id || !(await findOwn(newPair)))) return json(400, { error: "invalid_pair" });
    // Deshacer el vínculo anterior y crear el nuevo en ambos sentidos.
    if (current.suit_pair_id && current.suit_pair_id !== newPair) await setPair(current.suit_pair_id, null);
    if (newPair) {
      const pairRow = await findOwn(newPair);
      if (pairRow?.suit_pair_id && pairRow.suit_pair_id !== id) await setPair(pairRow.suit_pair_id, null);
      await setPair(newPair, id);
    }
  }

  const { data, error } = await db()
    .from("garments")
    .update({ ...garmentPatchToRow(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ownerId())
    .select()
    .single();
  if (error || !data) return json(500, { error: "db" });
  return withImageUrl(data as GarmentRow);
}

export async function DELETE(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json(400, { error: "invalid" });
  const current = await findOwn(id);
  if (!current) return json(404, { error: "not_found" });

  if (current.suit_pair_id) await setPair(current.suit_pair_id, null);
  await db().from("garments").delete().eq("id", id).eq("user_id", ownerId());
  if (current.image_path) await db().storage.from(BUCKET).remove([current.image_path]);
  return new Response(null, { status: 204 });
}

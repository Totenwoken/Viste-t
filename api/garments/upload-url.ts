import { z } from "zod";
import { requireAccess } from "../../server/access";
import { json } from "../../server/http";
import { BUCKET, db, ownerId } from "../../server/supabase";

const Body = z.object({ garmentId: z.string().min(1) });

/** URL firmada nueva para una prenda ya creada (las URL caducan; se pide al retomar una subida). */
export async function POST(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json(400, { error: "invalid" });

  const { data: row, error } = await db()
    .from("garments")
    .select("id, image_path")
    .eq("id", body.data.garmentId)
    .eq("user_id", ownerId())
    .maybeSingle();
  if (error) return json(500, { error: "db" });
  if (!row?.image_path) return json(404, { error: "not_found" });

  const signed = await db().storage.from(BUCKET).createSignedUploadUrl(row.image_path, { upsert: true });
  if (signed.error || !signed.data) return json(500, { error: "storage" });
  return json(200, { uploadUrl: signed.data.signedUrl });
}

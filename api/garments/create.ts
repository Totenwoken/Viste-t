import { randomUUID } from "node:crypto";
import { requireAccess } from "../../server/access.js";
import { json } from "../../server/http.js";
import { BUCKET, db, ownerId } from "../../server/supabase.js";

/** Crea la ficha vacía de una prenda y devuelve una URL firmada para subir su foto. */
export async function POST(req: Request): Promise<Response> {
  const denied = requireAccess(req);
  if (denied) return denied;

  const garmentId = randomUUID();
  const imagePath = `${ownerId()}/${garmentId}.webp`;

  const { error } = await db()
    .from("garments")
    .insert({ id: garmentId, user_id: ownerId(), status: "pending", image_path: imagePath })
    .select()
    .single();
  if (error) return json(500, { error: "db" });

  const signed = await db().storage.from(BUCKET).createSignedUploadUrl(imagePath);
  if (signed.error || !signed.data) return json(500, { error: "storage" });

  return json(201, { garmentId, uploadUrl: signed.data.signedUrl });
}

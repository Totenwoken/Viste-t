import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "garments";

let client: SupabaseClient | null = null;

/**
 * Deja solo el origen (https://xxxx.supabase.co). La librería añade /rest/v1 y /storage/v1 por su cuenta,
 * así que una URL copiada con ruta (p. ej. ".../rest/v1/") produce "Invalid path specified in request URL".
 */
export function normalizeSupabaseUrl(raw: string): string {
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").trim();
  return new URL(cleaned).origin;
}

const clean = (v: string | undefined) => v?.trim().replace(/^["']|["']$/g, "").trim();

/** Cliente con la service key. Solo se usa en el servidor. */
export function db(): SupabaseClient {
  if (!client) {
    const url = clean(process.env.SUPABASE_URL);
    const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(normalizeSupabaseUrl(url), key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export function ownerId(): string {
  const id = clean(process.env.OWNER_USER_ID);
  if (!id) throw new Error("Falta OWNER_USER_ID");
  return id;
}

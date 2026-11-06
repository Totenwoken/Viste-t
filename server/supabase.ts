import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "garments";

let client: SupabaseClient | null = null;

/** Cliente con la service key. Solo se usa en el servidor. */
export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export function ownerId(): string {
  const id = process.env.OWNER_USER_ID;
  if (!id) throw new Error("Falta OWNER_USER_ID");
  return id;
}

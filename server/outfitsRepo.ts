import type { Garment } from "../shared/garment.js";
import { usable, type Outfit } from "../shared/outfit.js";
import { rowToGarment, type GarmentRow } from "./garmentsRepo.js";
import type { HistoryItem } from "./outfitPrompt.js";
import { BUCKET, db, ownerId } from "./supabase.js";

export interface OutfitRow {
  id: string;
  user_id: string;
  mode: Outfit["mode"];
  request: string | null;
  garment_ids: string[];
  locked_ids: string[];
  explanation: string;
  status: Outfit["status"];
  reject_reason: Outfit["rejectReason"];
  worn_on: string | null;
  created_at: string;
}

export function rowToOutfit(row: OutfitRow, notes: string[] = []): Outfit {
  return {
    id: row.id,
    mode: row.mode,
    request: row.request ?? null,
    garmentIds: row.garment_ids ?? [],
    lockedIds: row.locked_ids ?? [],
    explanation: row.explanation ?? "",
    status: row.status,
    rejectReason: row.reject_reason ?? null,
    wornOn: row.worn_on ?? null,
    createdAt: row.created_at,
    notes,
  };
}

/** Fecha de hoy en España (YYYY-MM-DD). */
export function todayMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
}

function daysBefore(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Prendas que pueden entrar en un conjunto (listas, disponibles, sin complementos). */
export async function loadAvailable(): Promise<Garment[]> {
  const { data, error } = await db()
    .from("garments")
    .select("*")
    .eq("user_id", ownerId())
    .eq("status", "ready")
    .eq("availability", "disponible");
  if (error) throw new Error(error.message);
  return usable(((data ?? []) as GarmentRow[]).map((r) => rowToGarment(r)));
}

/** Prendas del propietario con esos ids (estén o no disponibles). */
export async function loadOwnGarments(ids: string[]): Promise<Garment[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db().from("garments").select("*").eq("user_id", ownerId()).in("id", ids);
  if (error) throw new Error(error.message);
  return ((data ?? []) as GarmentRow[]).map((r) => rowToGarment(r));
}

export async function loadOutfit(id: string): Promise<OutfitRow | null> {
  const { data } = await db().from("outfits").select("*").eq("id", id).eq("user_id", ownerId()).maybeSingle();
  return (data as OutfitRow | null) ?? null;
}

/** Lo puesto en los últimos 7 días y los últimos 30 conjuntos aceptados o rechazados. */
export async function loadHistory(today: string): Promise<{ wornRecently: string[]; history: HistoryItem[] }> {
  const { data, error } = await db()
    .from("outfits")
    .select("*")
    .eq("user_id", ownerId())
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OutfitRow[];
  const since = daysBefore(today, 6);
  const worn = new Set<string>();
  for (const r of rows) if (r.status === "worn" && r.worn_on && r.worn_on >= since) r.garment_ids.forEach((id) => worn.add(id));
  const history = rows
    .filter((r) => r.status === "worn" || r.status === "rejected")
    .slice(0, 30)
    .map((r) => ({
      garmentIds: r.garment_ids,
      status: r.status as "worn" | "rejected",
      rejectReason: r.reject_reason,
      date: r.worn_on ?? r.created_at.slice(0, 10),
    }));
  return { wornRecently: [...worn], history };
}

/** Añade imageUrl firmadas (1 h) a las prendas, en el orden dado. */
export async function withImageUrls(garments: Garment[]): Promise<Garment[]> {
  const rows = await loadOwnRowsPaths(garments.map((g) => g.id));
  const paths = [...rows.values()].filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const signed = await db().storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed.data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return garments.map((g) => {
    const path = rows.get(g.id);
    const url = path ? urls.get(path) : undefined;
    return url ? { ...g, imageUrl: url } : g;
  });
}

async function loadOwnRowsPaths(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data } = await db().from("garments").select("id, image_path").eq("user_id", ownerId()).in("id", ids);
  return new Map(((data ?? []) as { id: string; image_path: string | null }[]).map((r) => [r.id, r.image_path]));
}

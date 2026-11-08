import type { Garment } from "../../shared/garment";
import type { Outfit, OutfitMode, RejectReason, Weather } from "../../shared/outfit";
import { apiFetch } from "./api";

export class OutfitError extends Error {
  constructor(public kind: "not_enough" | "invalid_outfit", message: string) {
    super(message);
    this.name = "OutfitError";
  }
}

export interface GenerateBody {
  mode: OutfitMode;
  request?: string;
  lockedIds?: string[];
  previousOutfitId?: string;
  replaceId?: string;
  weather?: Weather | null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 422) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new OutfitError(data.error === "not_enough" ? "not_enough" : "invalid_outfit", data.message ?? "No se ha podido montar el conjunto");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const generateOutfit = (body: GenerateBody) =>
  post<{ outfit: Outfit; garments: Garment[] }>("/api/outfits/generate", body);

export const wearOutfit = (outfitId: string) => post<{ outfit: Outfit }>("/api/outfits/wear", { outfitId });

export const rejectOutfit = (outfitId: string, reason?: RejectReason) =>
  post<{ outfit: Outfit }>("/api/outfits/feedback", reason ? { outfitId, reason } : { outfitId });

export const wearOther = (garmentIds: string[]) => post<{ outfit: Outfit }>("/api/outfits/wear-other", { garmentIds });

export async function listGarments(): Promise<Garment[]> {
  const res = await apiFetch("/api/garments");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return ((await res.json()) as { garments: Garment[] }).garments;
}

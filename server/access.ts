import { createHash, timingSafeEqual } from "node:crypto";
import { json } from "./http";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Devuelve un 401 si el código de acceso falta o no coincide; null si es válido. */
export function requireAccess(req: Request): Response | null {
  const expected = process.env.ACCESS_CODE;
  const given = req.headers.get("x-access-code");
  if (!expected || given === null) return json(401, { error: "unauthorized" });
  // Se comparan los hashes para que la comparación sea de longitud fija y en tiempo constante.
  if (!timingSafeEqual(digest(given), digest(expected))) return json(401, { error: "unauthorized" });
  return null;
}

import { requireAccess } from "../../server/access.js";
import { json } from "../../server/http.js";

export function GET(req: Request): Response {
  if (requireAccess(req)) {
    // "configured" solo dice si el servidor tiene un código definido (ayuda a diagnosticar la puesta en marcha).
    return json(401, { error: "unauthorized", configured: Boolean(process.env.ACCESS_CODE) });
  }
  return json(200, { ok: true });
}

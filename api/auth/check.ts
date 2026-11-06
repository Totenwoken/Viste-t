import { requireAccess } from "../../server/access.js";
import { json } from "../../server/http.js";

export function GET(req: Request): Response {
  return requireAccess(req) ?? json(200, { ok: true });
}

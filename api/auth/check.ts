import { requireAccess } from "../../server/access";
import { json } from "../../server/http";

export function GET(req: Request): Response {
  return requireAccess(req) ?? json(200, { ok: true });
}

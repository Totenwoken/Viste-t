import { requireAccess } from "../../server/access.js";
import { json } from "../../server/http.js";

const EXPECTED_ENV = [
  "ACCESS_CODE",
  "ANTHROPIC_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_USER_ID",
  "MODEL_TAGGING",
  "MONTHLY_BUDGET_USD",
] as const;

export function GET(req: Request): Response {
  if (requireAccess(req)) {
    // Diagnóstico de la puesta en marcha: solo dice QUÉ variables existen (nunca sus valores),
    // en qué entorno de Vercel corre y qué versión del código.
    const env = Object.fromEntries(EXPECTED_ENV.map((k) => [k, Boolean(process.env[k])]));
    return json(401, {
      error: "unauthorized",
      configured: env.ACCESS_CODE,
      env,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    });
  }
  return json(200, { ok: true });
}

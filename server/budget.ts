import type { Task } from "./claude.js";
import { json } from "./http.js";
import { db, ownerId } from "./supabase.js";

/** Precio en dólares por millón de tokens. */
export const PRICES: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-opus-5-5": { in: 4, out: 20 },
};
const FALLBACK_PRICE = PRICES["claude-opus-5-5"]; // sobrestimar es más seguro

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  return (u.input_tokens * p.in + write * p.in * 1.25 + read * p.in * 0.1 + u.output_tokens * p.out) / 1_000_000;
}

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getMonthSpend(now: Date = new Date()): Promise<number> {
  const { data, error } = await db()
    .from("usage_ledger")
    .select("cost_usd")
    .eq("user_id", ownerId())
    .gte("created_at", monthStartUtc(now).toISOString());
  if (error) throw new Error(`No se pudo leer el gasto: ${error.message}`);
  return (data ?? []).reduce((sum: number, r: { cost_usd: number | string }) => sum + Number(r.cost_usd), 0);
}

export function budgetUsd(): number {
  const v = Number(process.env.MONTHLY_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : 5;
}

/** 402 si el gasto del mes ha llegado al tope; null si se puede llamar a Claude. */
export async function checkBudget(): Promise<Response | null> {
  return (await getMonthSpend()) >= budgetUsd() ? json(402, { error: "budget_exceeded" }) : null;
}

export async function recordUsage(task: Task, model: string, usage: Usage): Promise<void> {
  const { error } = await db().from("usage_ledger").insert({
    user_id: ownerId(),
    task,
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
    cost_usd: costUsd(model, usage),
  });
  if (error) throw new Error(`No se pudo registrar el gasto: ${error.message}`);
}

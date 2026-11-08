import Anthropic from "@anthropic-ai/sdk";

export type Task = "tagging" | "outfit";

const DEFAULT_MODEL = "claude-haiku-5-5";
const ENV_BY_TASK: Record<Task, string> = { tagging: "MODEL_TAGGING", outfit: "MODEL_OUTFIT" };

let client: Anthropic | null = null;

/** Cliente de Claude (lee ANTHROPIC_API_KEY del entorno). Solo servidor. */
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function modelFor(task: Task): string {
  return process.env[ENV_BY_TASK[task]] || DEFAULT_MODEL;
}

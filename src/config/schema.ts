import { z } from "zod";

export const DEFAULT_SYSTEM_PROMPT = [
  "You are Chatterly, a concise and direct assistant running on a small local model.",
  "Answer in as few words as the question honestly allows.",
  "If you do not know something, say so plainly rather than guessing.",
].join(" ");

/**
 * Every setting has a default, so the app starts with no .env at all. Validation happens
 * once at boot: a bad value fails loudly here rather than as a confusing error mid-turn.
 */
export const configSchema = z.object({
  provider: z.enum(["echo", "openai-compatible"]).default("echo"),
  baseUrl: z.url().default("http://localhost:11434/v1"),
  model: z.string().min(1).default("local-model"),
  apiKey: z.string().default("not-needed"),
  /**
   * Whether the chosen model can do native function calling. A property of the model,
   * not the server: one Ollama instance serves models that can and cannot, and the
   * endpoint cannot be asked. Read by "auto" tool-protocol selection.
   */
  nativeTools: z.stringbool().default(true),
  toolProtocol: z.enum(["auto", "native", "prompted"]).default("auto"),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  maxSteps: z.coerce.number().int().min(1).max(50).default(6),
  toolTimeoutMs: z.coerce.number().int().positive().default(10_000),
  contextBudgetChars: z.coerce.number().int().positive().default(12_000),
  dataDir: z.string().min(1).default(".data"),
  systemPrompt: z.string().default(DEFAULT_SYSTEM_PROMPT),
});

export type Config = z.infer<typeof configSchema>;

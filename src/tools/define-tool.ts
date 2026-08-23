import { type z } from "zod";
import { type ToolDefinition } from "./types/index.ts";

/**
 * Identity function that exists purely for inference: it pins `Schema` so `execute`
 * receives fully typed arguments without anyone writing the type twice.
 */
export function defineTool<Schema extends z.ZodType>(
  tool: ToolDefinition<Schema>,
): ToolDefinition<Schema> {
  return tool;
}

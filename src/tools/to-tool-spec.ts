import { z } from "zod";
import { type ToolSpec } from "../core/types/index.ts";
import { type ToolDefinition } from "./types/index.ts";

/**
 * Derives the wire form of a tool from its zod schema.
 *
 * draft-7 because that is what OpenAI-compatible servers expect; `io: "input"` because
 * the schema describes what the model must send, not what the handler receives after
 * defaults and transforms have been applied.
 */
export function toToolSpec(tool: ToolDefinition): ToolSpec {
  return {
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.parameters, { target: "draft-7", io: "input" }),
  };
}

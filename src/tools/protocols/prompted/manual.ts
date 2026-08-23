import { type ToolSpec } from "../../../core/types/index.ts";

export const TOOL_MANUAL_HEADER = "## Available tools";

/**
 * The tool manual injected into the system message.
 *
 * Written for a small model: one call per reply, no prose alongside the block, and the
 * schema shown verbatim. Every relaxation of those rules costs parsing reliability on
 * exactly the models this protocol exists to serve.
 */
export function renderToolManual(tools: ToolSpec[]): string {
  const entries = tools
    .map((tool) =>
      [
        `### ${tool.name}`,
        tool.description,
        `Arguments (JSON Schema): ${JSON.stringify(tool.parameters)}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    TOOL_MANUAL_HEADER,
    "",
    "To use a tool, reply with ONLY a fenced json block in exactly this shape:",
    "",
    "```json",
    '{"tool": "<tool name>", "args": { ... }}',
    "```",
    "",
    "Rules:",
    "- Call at most one tool per reply.",
    "- When calling a tool, write nothing except the block.",
    "- When you do not need a tool, reply normally and never mention this format.",
    "- After a tool result arrives, use it to answer the user in plain language.",
    "",
    entries,
  ].join("\n");
}

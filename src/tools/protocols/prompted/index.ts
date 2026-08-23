import { type Message, type ToolProtocol, type ToolSpec } from "../../../core/types/index.ts";
import { renderToolManual } from "./manual.ts";
import { parseToolCalls } from "./parse-tool-calls.ts";

export { TOOL_MANUAL_HEADER, renderToolManual } from "./manual.ts";
export { parseToolCalls } from "./parse-tool-calls.ts";
export { repairJson } from "./repair-json.ts";

/**
 * Tools described in the prompt, calls read back out of plain text.
 *
 * Works with any model that can follow an instruction, including ones with no
 * function-calling support at all. This is the fallback that makes "runtime-agnostic"
 * true rather than aspirational.
 */
export function promptedProtocol(): ToolProtocol {
  return {
    name: "prompted",
    prepare(request, tools) {
      if (tools.length === 0) return request;
      return { ...request, messages: withToolManual(request.messages, tools) };
    },
    extract(message) {
      return parseToolCalls(message.content);
    },
  };
}

/** Appends the manual to the first system message, or prepends one if there is none. */
function withToolManual(messages: Message[], tools: ToolSpec[]): Message[] {
  const manual = renderToolManual(tools);
  const index = messages.findIndex((message) => message.role === "system");

  if (index === -1) {
    return [{ role: "system", content: manual }, ...messages];
  }

  return messages.map((message, position) =>
    position === index ? { ...message, content: `${message.content}\n\n${manual}` } : message,
  );
}

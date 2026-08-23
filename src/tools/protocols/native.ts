import { type ToolProtocol } from "../../core/types/index.ts";

/**
 * Tools as structured request fields, tool calls as structured response fields.
 *
 * Almost a pass-through, and vendor-neutral: turning `tools` into whatever a given server
 * wants, and `tool_calls` back into ChatEvents, is the provider adapter's job. That is why
 * Anthropic, OpenAI and Gemini all share this one strategy rather than needing three.
 */
export function nativeProtocol(): ToolProtocol {
  return {
    name: "native",
    prepare(request, tools) {
      if (tools.length === 0) return request;
      return { ...request, tools };
    },
    extract(message) {
      return { ok: true, text: message.content, calls: message.toolCalls ?? [] };
    },
  };
}

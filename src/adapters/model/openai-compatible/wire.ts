import { type Message } from "../../../core/types/index.ts";
import { type ToolSpec } from "../../../core/types/index.ts";

/** The subset of the streaming response this adapter reads. */
export interface WireChunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: WireToolCallDelta[];
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

/** Tool calls arrive in fragments keyed by `index`, with `arguments` accumulating as text. */
export interface WireToolCallDelta {
  index?: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface WireMessage {
  role: string;
  content: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
}

/** Translates the internal transcript into the OpenAI chat format. */
export function toWireMessages(messages: Message[]): WireMessage[] {
  return messages.map((message) => {
    switch (message.role) {
      case "system":
      case "user":
        return { role: message.role, content: message.content };
      case "assistant":
        return {
          role: "assistant",
          content: message.content,
          ...(message.toolCalls && message.toolCalls.length > 0
            ? {
                tool_calls: message.toolCalls.map((call) => ({
                  id: call.id,
                  type: "function" as const,
                  function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
                })),
              }
            : {}),
        };
      case "tool":
        return {
          role: "tool",
          content: message.content,
          tool_call_id: message.toolCallId,
        };
    }
  });
}

export function toWireTools(tools: ToolSpec[]): {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

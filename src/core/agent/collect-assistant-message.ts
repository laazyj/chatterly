import {
  type ChatEvent,
  type ModelReply,
  type StreamSink,
  type ToolCall,
  type Usage,
} from "../types/index.ts";

/**
 * Folds a provider's event stream into one assistant message, forwarding text to the sink
 * as it arrives.
 *
 * The switch is exhaustive by lint rule: adding a ChatEvent variant fails the build here
 * first, which is exactly where you want to be told about it.
 */
export async function collectAssistantMessage(
  events: AsyncIterable<ChatEvent>,
  sink: StreamSink,
): Promise<ModelReply> {
  let content = "";
  let usage: Usage | undefined;
  let error: Error | undefined;
  const toolCalls: ToolCall[] = [];

  for await (const event of events) {
    switch (event.type) {
      case "text-delta":
        content += event.text;
        sink(event.text);
        break;
      case "tool-call":
        toolCalls.push(event.call);
        break;
      case "done":
        usage = event.usage ?? usage;
        break;
      case "error":
        error = event.error;
        break;
    }
  }

  return {
    message: {
      role: "assistant",
      content,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
    },
    ...(usage === undefined ? {} : { usage }),
    ...(error === undefined ? {} : { error }),
  };
}

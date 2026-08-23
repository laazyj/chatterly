import { type AssistantMessage } from "./message.ts";
import { type ChatRequest } from "./chat-request.ts";
import { type ToolCall } from "./tool-call.ts";
import { type ToolSpec } from "./tool-spec.ts";

export type ToolProtocolName = "native" | "prompted";

/**
 * The outcome of reading a model's reply.
 *
 * A failure is a value, not an exception: an unreadable tool call is an ordinary thing for
 * a small model to produce, and the loop's response is to show the model its mistake — not
 * to unwind the turn. Returning it also keeps the core free of any runtime import from the
 * tools module.
 */
export type ExtractResult =
  { ok: true; text: string; calls: ToolCall[] } | { ok: false; reason: string; raw: string };

/**
 * STRATEGY — not a port. It adapts to no external system; it varies how tools are
 * expressed to a model and read back, which is an algorithm inside the core.
 *
 * It exists because small local models are unreliable at native tool-calling APIs, so the
 * same tool must be presentable either as a structured request field or as instructions in
 * the prompt. Configuration picks the strategy to match the model.
 *
 * Note what this does *not* vary: vendor wire format. Anthropic, OpenAI and Gemini shapes
 * are the provider adapter's business — a new vendor with native tools needs a new adapter,
 * not a new strategy. New strategies are for new *elicitation techniques*: XML tags,
 * constrained decoding, ReAct.
 */
export interface ToolProtocol {
  readonly name: ToolProtocolName;
  /** Attach tools to the outgoing request, natively or by amending the system message. */
  prepare(request: ChatRequest, tools: ToolSpec[]): ChatRequest;
  /** Split a finished assistant message into user-visible text and tool calls. */
  extract(message: AssistantMessage): ExtractResult;
}

import { type Tracer } from "../ports/index.ts";
import { type Message } from "./message.ts";
import { type ToolResult } from "./tool-result.ts";

/**
 * Mutable state for one user turn, threaded through the loop and handed to every
 * interceptor. This is the extension surface: a spike reads and mutates this rather
 * than editing the loop.
 *
 * Interceptors stop the loop by setting `halt` (with a `haltReason` for the trace).
 */
export interface TurnContext {
  readonly sessionId: string;
  readonly turnId: string;
  readonly startedAt: number;
  readonly signal: AbortSignal;
  readonly trace: Tracer;
  /** Zero-based index of the model call about to happen, or the one just completed. */
  step: number;
  /** Working transcript: assembled context first, then assistant and tool messages. */
  messages: Message[];
  /** Text of the most recent assistant message. */
  finalText: string;
  toolResults: ToolResult[];
  halt: boolean;
  haltReason?: string;
}

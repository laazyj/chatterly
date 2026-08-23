import { type ModelReply } from "./model-reply.ts";
import { type ToolCall } from "./tool-call.ts";
import { type ToolResult } from "./tool-result.ts";
import { type TurnContext } from "./turn-context.ts";

/** Invokes the rest of the chain. Not calling it short-circuits everything downstream. */
export type Next<T> = () => Promise<T>;

/**
 * Wraps a model call. Chain of responsibility: each link decides whether, when and how
 * often to call `next`, and may replace or repair what comes back.
 *
 * This is what before/after hooks cannot express — retry a malformed reply, serve one from
 * cache, fall back to a second provider, put a deadline around the call.
 */
export type ModelMiddleware = (ctx: TurnContext, next: Next<ModelReply>) => Promise<ModelReply>;

/** Wraps a single tool invocation. Same contract, plus the call being made. */
export type ToolMiddleware = (
  ctx: TurnContext,
  call: ToolCall,
  next: Next<ToolResult>,
) => Promise<ToolResult>;

import { type ModelMiddleware, type ToolMiddleware } from "./middleware.ts";
import { type ToolCall } from "./tool-call.ts";
import { type ToolResult } from "./tool-result.ts";
import { type TurnContext } from "./turn-context.ts";

/**
 * A plug-in around the agent loop. SEAM — this is where spikes add behaviour instead of
 * editing agent.ts.
 *
 * Two mechanisms, because they answer different questions:
 *
 * - `before*` / `after*` **observe and mutate**. They run in onion order (before in
 *   registration order, after reversed) and may stop the loop by setting `ctx.halt`. Use
 *   these for budgets, trimming, logging — anything that inspects state around a call.
 *
 * - `around*` **intercept**. Each receives `next` and decides whether, when and how often
 *   to call it, so it can retry, cache, replace, catch or refuse. Use these when the call
 *   itself must change.
 *
 * Every member is optional; implement only what you need. Throwing aborts the turn — halt
 * means "we are done", exceptions mean "something is wrong".
 */
export interface Interceptor {
  readonly name: string;
  beforeModel?(ctx: TurnContext): Promise<void> | void;
  afterModel?(ctx: TurnContext): Promise<void> | void;
  aroundModel?: ModelMiddleware;
  beforeTool?(ctx: TurnContext, call: ToolCall): Promise<void> | void;
  afterTool?(ctx: TurnContext, result: ToolResult): Promise<void> | void;
  aroundTool?: ToolMiddleware;
}

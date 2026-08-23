import { type ToolCall } from "../types/tool-call.ts";
import { type ToolContext } from "../types/tool-context.ts";
import { type ToolResult } from "../types/tool-result.ts";
import { type ToolSpec } from "../types/tool-spec.ts";

/**
 * How the loop reaches the outside world. SEAM.
 *
 * The core depends on this rather than on `ToolRegistry` so a spike can substitute a
 * remote executor, a sandboxed one, or an approval-gated one without the agent noticing.
 *
 * `execute` must not throw: a failed tool is a ToolResult with `isError`, because the
 * model can often recover from being told what went wrong.
 */
export interface ToolExecutor {
  /** What the model is allowed to call, in wire form. */
  specs(): ToolSpec[];
  execute(call: ToolCall, context: ToolContext): Promise<ToolResult>;
}

/**
 * A tool invocation requested by the model.
 *
 * `args` is deliberately `unknown`: it arrives from model output and stays untrusted
 * until ToolRegistry validates it against the tool's zod schema.
 */
export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

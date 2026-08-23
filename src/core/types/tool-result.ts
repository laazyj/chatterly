/**
 * The outcome of executing a ToolCall.
 *
 * Failures are values, not exceptions: a failed tool still produces a result that goes
 * back to the model, because "that tool errored" is information the model can act on.
 */
export interface ToolResult {
  callId: string;
  name: string;
  content: string;
  isError: boolean;
  durationMs: number;
}

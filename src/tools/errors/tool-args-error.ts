/**
 * The model's arguments failed the tool's zod schema.
 *
 * `detail` is written to be read by the model, not just by a human: it goes back into the
 * transcript as the tool result so the model can correct itself on the next step.
 */
export class ToolArgsError extends Error {
  readonly toolName: string;
  readonly detail: string;

  constructor(toolName: string, detail: string) {
    super(`Invalid arguments for "${toolName}": ${detail}`);
    this.name = "ToolArgsError";
    this.toolName = toolName;
    this.detail = detail;
  }
}

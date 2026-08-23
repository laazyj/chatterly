/** The model asked for a tool that is not registered. */
export class UnknownToolError extends Error {
  readonly toolName: string;

  constructor(toolName: string) {
    super(`Unknown tool "${toolName}"`);
    this.name = "UnknownToolError";
    this.toolName = toolName;
  }
}

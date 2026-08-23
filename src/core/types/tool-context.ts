/** What a tool handler gets besides its validated arguments. */
export interface ToolContext {
  /** Aborts when the turn is cancelled or the tool exceeds its timeout. Long tools must honour it. */
  readonly signal: AbortSignal;
  readonly sessionId: string;
  readonly turnId: string;
}

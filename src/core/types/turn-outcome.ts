import { type ToolResult } from "./tool-result.ts";
import { type Usage } from "./usage.ts";

/** What Agent.run resolves to once the loop finishes, halts, or is aborted. */
export interface TurnOutcome {
  text: string;
  /** Number of model calls made — 1 for a plain answer, more once tools are involved. */
  steps: number;
  toolResults: ToolResult[];
  haltReason?: string;
  usage?: Usage;
}

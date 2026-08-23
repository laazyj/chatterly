/** What kind of work a span covers. One line per span in the trace file. */
export type SpanKind = "turn" | "context" | "model" | "tool";

/** A completed unit of work, written as one JSONL line. */
export interface Span {
  kind: SpanKind;
  name: string;
  sessionId: string;
  turnId: string;
  step: number;
  startedAt: number;
  durationMs: number;
  ok: boolean;
  /** Free-form detail: token counts, tool args, halt reasons. Kept small enough to grep. */
  attributes: Record<string, unknown>;
}

import { type Span } from "../types/span.ts";

/**
 * Records what the agent did. The scaffold ships a JSONL tracer and a no-op one.
 *
 * `start` returns the function that ends the span, so callers cannot forget which span
 * they are closing and nesting stays lexical.
 */
export interface Tracer {
  start(
    span: Pick<Span, "kind" | "name" | "step">,
  ): (outcome?: { ok?: boolean; attributes?: Record<string, unknown> }) => void;
  /** Where the spans went, for the CLI's `/trace` command. Undefined when not persisted. */
  readonly location?: string;
}

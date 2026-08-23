import { type ToolCall } from "./tool-call.ts";
import { type Usage } from "./usage.ts";

/**
 * The single wire format every provider emits.
 *
 * Streaming is the only mode: a non-streaming provider yields one text-delta then done.
 * Keeping this a discriminated union means adding a modality later (images, reasoning
 * traces) is a compile error at every consumer rather than a silent drop.
 */
export type ChatEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; call: ToolCall }
  | { type: "done"; usage?: Usage }
  | { type: "error"; error: Error };

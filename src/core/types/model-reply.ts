import { type AssistantMessage } from "./message.ts";
import { type Usage } from "./usage.ts";

/**
 * One model call's result, folded from the provider's event stream.
 *
 * This is what model middleware passes along, so a retry or cache middleware deals in
 * whole replies rather than in half-consumed streams.
 */
export interface ModelReply {
  message: AssistantMessage;
  usage?: Usage;
  /** Providers report failures as events rather than throwing, so this is how they surface. */
  error?: Error;
}

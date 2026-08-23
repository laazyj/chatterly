import { type ChatEvent, type ChatRequest } from "../../core/types/index.ts";
import { type ProviderCapabilities } from "./provider-capabilities.ts";

/**
 * The model seam. One method, always streaming — a non-streaming backend yields a single
 * text-delta then done, so the loop never branches on transport.
 *
 * Implementations must honour `signal` by aborting the underlying request, not merely by
 * ceasing to yield.
 */
export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;
  chat(request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
}

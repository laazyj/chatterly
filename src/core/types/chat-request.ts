import { type ToolSpec } from "./tool-spec.ts";
import { type Message } from "./message.ts";

/**
 * What a provider is asked to do.
 *
 * `tools` is populated by ToolProtocol.prepare only under the native protocol. The
 * prompted protocol folds the tool manual into the system message and leaves this unset,
 * which is what lets one provider serve both protocols unchanged.
 */
export interface ChatRequest {
  model: string;
  messages: Message[];
  temperature: number;
  tools?: ToolSpec[];
  stop?: string[];
}

import { type ProviderCapabilities } from "../../core/ports/index.ts";
import { type ToolProtocol, type ToolProtocolName } from "../../core/types/index.ts";
import { nativeProtocol } from "./native.ts";
import { promptedProtocol } from "./prompted/index.ts";

export type ToolProtocolSetting = "auto" | ToolProtocolName;

/**
 * The strategy registry. Adding an elicitation technique — XML tags, constrained decoding,
 * ReAct — means adding an entry here and a name to `ToolProtocolName`, not editing a
 * switch in the core.
 */
export const TOOL_PROTOCOLS: Record<ToolProtocolName, () => ToolProtocol> = {
  native: nativeProtocol,
  prompted: promptedProtocol,
};

/**
 * Resolves the configured setting against what the model can actually do.
 *
 * Precedence is explicit: a named protocol always wins, which is how you A/B the two
 * against one model. "auto" follows the provider's declared capability, which comes from
 * `CHATTERLY_NATIVE_TOOLS` — a property of the model, not of the server.
 *
 * When nothing is known, `prompted` is the safe answer: it works with any model that can
 * follow an instruction, whereas `native` silently produces a model that never calls tools.
 */
export function selectToolProtocol(
  setting: ToolProtocolSetting,
  capabilities: ProviderCapabilities,
): ToolProtocol {
  if (setting !== "auto") return TOOL_PROTOCOLS[setting]();
  return capabilities.nativeTools ? nativeProtocol() : promptedProtocol();
}

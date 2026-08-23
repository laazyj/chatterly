/**
 * What a backend can do. Read by tool-protocol selection when CHATTERLY_TOOL_PROTOCOL
 * is "auto", so a provider that cannot do native tool calls transparently gets the
 * prompted protocol instead.
 */
export interface ProviderCapabilities {
  nativeTools: boolean;
  streaming: boolean;
}

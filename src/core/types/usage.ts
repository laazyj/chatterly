/** Token accounting, when the provider reports it. Local servers often do not. */
export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
}

import { type Config } from "../../config/index.ts";
import { echoProvider } from "./echo/index.ts";
import { openAiCompatibleProvider } from "./openai-compatible/index.ts";
import { type ModelProvider } from "../../core/ports/index.ts";

/** The one place a config value becomes a provider. Add a runtime by adding a case. */
export function createProvider(config: Config): ModelProvider {
  switch (config.provider) {
    case "echo":
      return echoProvider();
    case "openai-compatible":
      return openAiCompatibleProvider({
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        nativeTools: config.nativeTools,
      });
  }
}

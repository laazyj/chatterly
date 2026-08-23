import { createApp } from "./app.ts";
import { startRepl } from "./adapters/driving/cli/repl.ts";
import { loadConfig } from "./config/index.ts";

/**
 * Entry point. Configuration failures die here with a readable message rather than
 * surfacing three layers deep mid-conversation.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const app = createApp(config);
  await startRepl(app);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

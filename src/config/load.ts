import { type Config, configSchema } from "./schema.ts";

/** Field name to environment variable. Drives both parsing and error messages. */
const ENV_KEYS: Record<keyof Config, string> = {
  provider: "CHATTERLY_PROVIDER",
  baseUrl: "CHATTERLY_BASE_URL",
  model: "CHATTERLY_MODEL",
  apiKey: "CHATTERLY_API_KEY",
  nativeTools: "CHATTERLY_NATIVE_TOOLS",
  toolProtocol: "CHATTERLY_TOOL_PROTOCOL",
  temperature: "CHATTERLY_TEMPERATURE",
  maxSteps: "CHATTERLY_MAX_STEPS",
  toolTimeoutMs: "CHATTERLY_TOOL_TIMEOUT_MS",
  contextBudgetChars: "CHATTERLY_CONTEXT_BUDGET_CHARS",
  dataDir: "CHATTERLY_DATA_DIR",
  systemPrompt: "CHATTERLY_SYSTEM_PROMPT",
};

/** Treat empty and whitespace-only env vars as absent, so `FOO=` falls back to the default. */
function readEnv(key: string): string | undefined {
  const raw = process.env[key]?.trim();
  return raw === undefined || raw === "" ? undefined : raw;
}

/**
 * Node reads .env natively; there is no dotenv dependency. A missing file is the normal
 * case, not an error — that is what makes `npm start` work on a clean checkout.
 */
function loadEnvFile(path = ".env"): void {
  try {
    process.loadEnvFile(path);
  } catch {
    // No .env: every setting falls back to its default.
  }
}

export function loadConfig(): Config {
  loadEnvFile();

  const raw = Object.fromEntries(
    Object.entries(ENV_KEYS).map(([field, envKey]) => [field, readEnv(envKey)]),
  );

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => {
        const field = issue.path[0];
        const envKey =
          typeof field === "string" && field in ENV_KEYS
            ? ENV_KEYS[field as keyof Config]
            : String(field);
        return `  ${envKey}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(`Invalid configuration:\n${detail}`);
  }

  return parsed.data;
}

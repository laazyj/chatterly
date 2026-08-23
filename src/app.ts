import { jsonlSessionStore } from "./adapters/memory/jsonl-session-store.ts";
import { nullMemoryStore } from "./adapters/memory/null-memory-store.ts";
import { createProvider } from "./adapters/model/create-provider.ts";
import { nullRetriever } from "./adapters/retrieval/null-retriever.ts";
import { createJsonlTracer } from "./adapters/tracing/jsonl-tracer.ts";
import { type Config } from "./config/index.ts";
import { Agent } from "./core/agent/index.ts";
import { createContextAssembler } from "./core/context/index.ts";
import {
  stepBudgetInterceptor,
  tracingInterceptor,
  transcriptTrimInterceptor,
} from "./core/interceptors/index.ts";
import { Pipeline } from "./core/pipeline.ts";
import {
  type ConversationPort,
  type ModelProvider,
  type SessionStore,
} from "./core/ports/index.ts";
import { type ToolProtocol } from "./core/types/index.ts";
import { clockTool } from "./tools/builtin/clock.ts";
import { selectToolProtocol } from "./tools/protocols/select.ts";
import { ToolRegistry } from "./tools/registry.ts";

export interface App {
  config: Config;
  /** What driving adapters talk to. They depend on this port, not on `Agent`. */
  conversation: ConversationPort;
  /** Concrete registry rather than the port: the CLI lists tools, which no port exposes. */
  tools: ToolRegistry;
  sessions: SessionStore;
  provider: ModelProvider;
  protocol: ToolProtocol;
}

/**
 * The composition root: the one place every seam is chosen and wired.
 *
 * This is where a spike plugs in. Swap `nullRetriever()` for a real retriever, swap
 * `nullMemoryStore()` for a real store, add a tool to the registry, add an interceptor to
 * the pipeline — each is a one-line change here and nothing else in the codebase moves.
 *
 * Interceptor order matters: tracing is registered first so it is the outermost wrapper
 * and its spans cover everything the links inside it do.
 */
export function createApp(config: Config): App {
  const provider = createProvider(config);
  const protocol = selectToolProtocol(config.toolProtocol, provider.capabilities);

  const tools = new ToolRegistry({ timeoutMs: config.toolTimeoutMs }).register(clockTool);

  const sessions = jsonlSessionStore(config.dataDir);
  const memory = nullMemoryStore();
  const retriever = nullRetriever();

  const context = createContextAssembler({
    systemPrompt: config.systemPrompt,
    sessions,
    memory,
    retriever,
  });

  const pipeline = new Pipeline([
    tracingInterceptor(),
    stepBudgetInterceptor(config.maxSteps),
    transcriptTrimInterceptor(config.contextBudgetChars),
  ]);

  const conversation = new Agent({
    provider,
    protocol,
    tools,
    context,
    sessions,
    pipeline,
    temperature: config.temperature,
    createTracer: (sessionId, turnId) =>
      createJsonlTracer({ dir: config.dataDir, sessionId, turnId }),
  });

  return { config, conversation, tools, sessions, provider, protocol };
}

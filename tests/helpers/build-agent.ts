import { Agent } from "../../src/core/agent/index.ts";
import { createContextAssembler } from "../../src/core/context/index.ts";
import { Pipeline } from "../../src/core/pipeline.ts";
import { type Interceptor, type Message } from "../../src/core/types/index.ts";
import { nullMemoryStore } from "../../src/adapters/memory/null-memory-store.ts";
import { type SessionStore } from "../../src/core/ports/index.ts";
import { nullTracer } from "../../src/adapters/tracing/null-tracer.ts";
import { type ModelProvider } from "../../src/core/ports/index.ts";
import { nullRetriever } from "../../src/adapters/retrieval/null-retriever.ts";
import { ToolRegistry } from "../../src/tools/registry.ts";
import { type ToolProtocol } from "../../src/core/types/index.ts";
import { type ToolDefinition } from "../../src/tools/types/index.ts";
import { nativeProtocol } from "../../src/tools/protocols/native.ts";

/** In-memory SessionStore, so loop tests never touch the filesystem. */
export function memorySessionStore(): SessionStore & { readonly messages: Message[] } {
  const messages: Message[] = [];
  return {
    messages,
    append(_sessionId, batch) {
      messages.push(...batch);
      return Promise.resolve();
    },
    load() {
      return Promise.resolve([...messages]);
    },
    list() {
      return Promise.resolve(["test"]);
    },
  };
}

export interface BuildAgentOptions {
  provider: ModelProvider;
  protocol?: ToolProtocol;
  tools?: ToolDefinition[];
  interceptors?: Interceptor[];
  sessions?: SessionStore;
  timeoutMs?: number;
}

/** Assembles an Agent from test doubles — the same wiring as createApp, minus the disk. */
export function buildAgent(options: BuildAgentOptions): Agent {
  const registry = new ToolRegistry({ timeoutMs: options.timeoutMs ?? 1_000 });
  for (const tool of options.tools ?? []) registry.register(tool);

  const sessions = options.sessions ?? memorySessionStore();

  return new Agent({
    provider: options.provider,
    protocol: options.protocol ?? nativeProtocol(),
    tools: registry,
    sessions,
    context: createContextAssembler({
      systemPrompt: "test",
      sessions,
      memory: nullMemoryStore(),
      retriever: nullRetriever(),
    }),
    pipeline: new Pipeline(options.interceptors ?? []),
    temperature: 0,
    createTracer: () => nullTracer,
  });
}

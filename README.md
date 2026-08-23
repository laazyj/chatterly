# Chatterly

An AI-native conversational agent in TypeScript, built to run against a small local LLM. It is a
scaffold for experimentation rather than a product: the extension seams — tools, memory, retrieval,
observability — are real, typed and wired into every turn, and the implementations behind three of
them are deliberately stubs that do nothing.

That is the whole design. Adding real retrieval means writing one file that implements `Retriever`
and changing one line in `src/app.ts`. Nothing in the agent loop moves.

Three patterns carry that, and which one applies where is deliberate:

- **Ports & Adapters** for anything outside the core — models, memory, retrieval, tools, tracing.
  Ports live in `src/core/ports/`, adapters in `src/adapters/`. The core never imports an adapter.
- **Strategy** for the tool protocol, because it adapts to no external system — it varies an
  algorithm _inside_ the core, chosen by configuration to match the model.
- **Chain of responsibility** for interceptors, so a link can wrap a call rather than merely watch
  it happen either side.

## Quick start

```bash
npm install
npm start
```

No model, no `.env`, no configuration: the default `echo` provider exercises streaming, tool calls
and tool results so the loop is runnable and testable on a clean checkout.

For a real model, any OpenAI-compatible server works. With Ollama:

```bash
brew install ollama
brew services start ollama   # or run `ollama serve` in a terminal
ollama pull qwen3:4b

cp .env.example .env   # set provider=openai-compatible, model=qwen3:4b
npm start
```

LM Studio (`http://localhost:1234/v1`) and `llama-server` (`http://localhost:8080/v1`) need only a
different `CHATTERLY_BASE_URL`.

### Does your model support native tool calling?

`CHATTERLY_NATIVE_TOOLS` describes the **model**, not the server — one Ollama instance serves
models that can and cannot, and the endpoint cannot be asked. It is not guesswork though:

```bash
ollama show qwen3:4b        # look for "tools" under Capabilities
```

LM Studio shows the same on a model's card; for a raw GGUF, native tool support depends on the
chat template, so assume `false` unless you know otherwise. If in doubt, `false` is the safe
answer — `prompted` works with any model that can follow an instruction, whereas `native` on a
model that ignores the field produces an agent that silently never calls a tool.

The empirical check is one command, and beats reading any spec sheet:

```bash
CHATTERLY_TOOL_PROTOCOL=native   npm run eval
CHATTERLY_TOOL_PROTOCOL=prompted npm run eval
```

## Architecture

A turn is a loop, and everything else is a plug-in to that loop.

```
                 ┌──────────────────────────────────────────────┐
   user input ──►│  Agent.run()                                 │
                 │                                              │
                 │  ContextAssembler.build()                    │◄── Retriever (stub)
                 │      system + memory + retrieved + history   │◄── MemoryStore (stub)
                 │                     │                        │◄── SessionStore (JSONL)
                 │                     ▼                        │
                 │        ┌── beforeModel hooks ──┐             │
                 │        │  ToolProtocol.prepare │             │◄── ToolRegistry
                 │        │  ModelProvider.chat   │──► deltas ──┼──► CLI (streams to stdout)
                 │        │  ToolProtocol.extract │             │
                 │        └── afterModel hooks ───┘             │
                 │              │            │                  │
                 │        no calls        calls                 │
                 │              │            ▼                  │
                 │              │   before/afterTool hooks      │
                 │              │   execute (zod-validated)     │
                 │              │            │                  │
                 │              │            └──► loop (≤ maxSteps)
                 │              ▼                               │
                 │        finalize: persist turn, flush trace   │
                 └──────────────────────────────────────────────┘
```

| Component          | Responsibility                                                           | File                               |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------- |
| `Agent`            | The loop: ask, run tools, ask again, stop. Implements `ConversationPort` | `src/core/agent/index.ts`          |
| `Pipeline`         | Hook ordering and middleware composition                                 | `src/core/pipeline.ts`             |
| `ContextAssembler` | Builds the starting transcript from prompt, memory, docs, history        | `src/core/context/index.ts`        |
| `Interceptor`      | Plug-in around each model and tool call                                  | `src/core/types/interceptor.ts`    |
| `ConversationPort` | Inbound port — what the REPL, evals and tests depend on                  | `src/core/ports/conversation.ts`   |
| `ModelProvider`    | Port: streams `ChatEvent`s from a backend                                | `src/core/ports/model-provider.ts` |
| `ToolExecutor`     | Port: what the loop calls instead of the concrete registry               | `src/core/ports/tool-executor.ts`  |
| `SessionStore`     | Port: append-only transcript persistence                                 | `src/core/ports/session-store.ts`  |
| `MemoryStore`      | Port: long-term recall — **null adapter**                                | `src/core/ports/memory-store.ts`   |
| `Retriever`        | Port: document retrieval — **null adapter**                              | `src/core/ports/retriever.ts`      |
| `Tracer`           | Port: one JSONL span per unit of work                                    | `src/core/ports/tracer.ts`         |
| `ToolProtocol`     | Strategy: how tools are shown to a model and read back                   | `src/core/types/tool-protocol.ts`  |
| `ToolRegistry`     | The `ToolExecutor` adapter: validates and runs tools                     | `src/tools/registry.ts`            |
| `createApp`        | The configurator, where every seam is chosen                             | `src/app.ts`                       |

Control flow is the model's decision: there are no coded plan/act/respond stages and no branching on
intent. Behaviour is added as a tool, an interceptor, or richer context — never as another branch in
the loop.

## The seams

**Tools** — implement `ToolDefinition` with `defineTool` (`src/tools/define-tool.ts`) and register
it in `createApp`. The zod schema is the single source of truth: the JSON Schema sent to native
models and the text manual shown to prompted ones are both derived from it. Copy
`src/tools/builtin/clock.ts`.

**Tool protocols** — small local models are unreliable at native tool-calling APIs, so the same
tool must be presentable both ways. `native` uses the `tools`/`tool_calls` fields; `prompted`
writes a manual into the system prompt and parses a fenced JSON block back out, with one repair
attempt, reporting failure as a value rather than throwing. Register a new strategy in
`TOOL_PROTOCOLS` (`src/tools/protocols/select.ts`).

Note what the strategy does _not_ vary: vendor wire format. Anthropic, OpenAI and Gemini shapes are
the provider adapter's job, so all three share the one `native` strategy — a new vendor needs a new
adapter. New strategies are for new elicitation techniques (XML tags, constrained decoding, ReAct).

**Memory** — `MemoryStore` is called every turn and currently returns nothing. Implement
`recall`/`remember`, swap `nullMemoryStore()` in `createApp`, and recollections appear in the
system prompt. Conversation persistence is separate and already real: `SessionStore` writes JSONL.

**Retrieval** — `Retriever` is likewise called every turn and returns nothing. Not an embeddings
interface on purpose: whether relevance comes from vectors, BM25 or SQL `LIKE` is the retriever's
business.

**Interceptors** — two mechanisms, for two different jobs:

- `beforeModel` / `afterModel` / `beforeTool` / `afterTool` **observe and mutate**, and can stop
  the loop by setting `ctx.halt`. Shipped: `stepBudgetInterceptor`, `transcriptTrimInterceptor`.
- `aroundModel` / `aroundTool` **intercept**: each receives `next` and decides whether, when and
  how often to call it — retry, cache, fall back, refuse. Shipped: `tracingInterceptor`, which
  needs `around` because a span must close even when the call throws.

Add either to the `Pipeline` in `createApp` rather than editing `agent.ts`. First registered is
outermost.

**Providers** — implement `ModelProvider` and add a case to `createProvider`
(`src/adapters/model/create-provider.ts`). One streaming method; a non-streaming backend yields a
single text delta then `done`.

**Evals** — the runner is a _driving_ adapter, not a seam of the agent. Its own two ports are in
`evals/ports/`: `CaseSource` (where cases come from) and `Grader` (how a turn is judged). Swap
either in one line in `evals/run.ts`.

## Configuration

Every value has a default, so nothing is required. See `.env.example`.

| Variable                         | Default                     | Notes                             |
| -------------------------------- | --------------------------- | --------------------------------- |
| `CHATTERLY_PROVIDER`             | `echo`                      | `echo` or `openai-compatible`     |
| `CHATTERLY_BASE_URL`             | `http://localhost:11434/v1` | Ollama, LM Studio, llama.cpp      |
| `CHATTERLY_MODEL`                | `local-model`               |                                   |
| `CHATTERLY_API_KEY`              | `not-needed`                | Most local servers ignore it      |
| `CHATTERLY_NATIVE_TOOLS`         | `true`                      | Can the **model** call functions? |
| `CHATTERLY_TOOL_PROTOCOL`        | `auto`                      | `auto`, `native`, `prompted`      |
| `CHATTERLY_TEMPERATURE`          | `0.7`                       |                                   |
| `CHATTERLY_MAX_STEPS`            | `6`                         | Model calls per turn              |
| `CHATTERLY_TOOL_TIMEOUT_MS`      | `10000`                     | Per tool call                     |
| `CHATTERLY_CONTEXT_BUDGET_CHARS` | `12000`                     | Characters, not tokens            |
| `CHATTERLY_DATA_DIR`             | `.data`                     | Sessions and traces               |
| `CHATTERLY_SYSTEM_PROMPT`        | see `src/config/schema.ts`  |                                   |

## Commands

| Command                 | What it proves                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `npm start`             | The loop runs, with or without a model                                                        |
| `npm run check`         | Typecheck, lint and tests all pass                                                            |
| `npm test`              | The seams behave: protocol parsing, registry validation, hook ordering, the loop, persistence |
| `npm run test:coverage` | Core logic stays covered (a floor, not a target)                                              |
| `npm run eval`          | Scripted conversations still reach the right answers                                          |

Node runs the TypeScript directly — no build step. Relative imports therefore need explicit `.ts`
extensions, and only erasable syntax is allowed (no enums, namespaces or parameter properties);
`tsc --noEmit` enforces both.

In the REPL: `/new`, `/tools`, `/history`, `/trace`, `/model`, `/help`, `/quit`. Ctrl-C interrupts a
generation; at the prompt it exits.

## Traces

Every turn writes spans to `.data/traces/<session>.jsonl` — one line per model call, tool call,
context assembly and protocol extraction:

```
context   assemble  step=0 ok=True {'messages': 2}
model     model     step=0 ok=True {'chars': 41, 'calls': 1}
tool      clock     step=0 ok=True {'args': {}, 'durationMs': 22}
model     model     step=1 ok=True {'chars': 60, 'calls': 0}
turn      turn      step=0 ok=True {'steps': 2, 'tools': 1}
```

Spans share the step of the model call that caused them, so one round trip reads as one group.
Model and tool spans come from `tracingInterceptor`; remove it from the pipeline and they stop,
with no edit to the loop.

## Deliberate omissions

No web UI, no HTTP transport, no multi-agent orchestration, no auth, no real vector search, and no
model-graded evals — a judge running on the same small local model would be less reliable than the
thing it judges. Absence here is a decision, not an oversight.

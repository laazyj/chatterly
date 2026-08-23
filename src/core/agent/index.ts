import { randomUUID } from "node:crypto";
import {
  type ConversationPort,
  type ModelProvider,
  type RunInput,
  type SessionStore,
  type ToolExecutor,
  type Tracer,
} from "../ports/index.ts";
import { type Pipeline } from "../pipeline.ts";
import {
  type AssistantMessage,
  type ContextAssembler,
  type Message,
  type StreamSink,
  type ToolMessage,
  type ToolProtocol,
  type TurnContext,
  type TurnOutcome,
  type Usage,
} from "../types/index.ts";
import { collectAssistantMessage } from "./collect-assistant-message.ts";

const MAX_PARSE_RETRIES = 1;

/** The specific parse failure goes back to the model: a small model corrects a named
 *  fault far more reliably than a generic "try again". */
const retryPrompt = (reason: string): string =>
  `That reply was meant to be a tool call, but ${reason}. Reply again with only a fenced ` +
  "json block in the documented shape, or answer in plain language without one.";

export interface AgentOptions {
  provider: ModelProvider;
  protocol: ToolProtocol;
  tools: ToolExecutor;
  context: ContextAssembler;
  sessions: SessionStore;
  pipeline: Pipeline;
  temperature: number;
  createTracer: (sessionId: string, turnId: string) => Tracer;
}

const noopSink: StreamSink = () => {
  // Discards text; used when the reply must be parsed before it can be shown.
};

/**
 * The loop. Ask the model; if it asked for tools, run them and ask again; stop when it
 * answers, an interceptor halts, or the turn is cancelled.
 *
 * There is no hard-coded conversational flow here by design — no plan/act/respond stages,
 * no branching on intent. What the agent does next is the model's decision, and every
 * behaviour a spike wants to add arrives as an interceptor, a tool, or a richer context
 * assembler rather than as another branch in this function.
 *
 * It depends only on ports (`ModelProvider`, `ToolExecutor`, `SessionStore`, `Tracer`) and
 * implements one (`ConversationPort`), so nothing here knows what a model or a tool
 * actually is.
 */
export class Agent implements ConversationPort {
  readonly #options: AgentOptions;

  constructor(options: AgentOptions) {
    this.#options = options;
  }

  get toolProtocolName(): string {
    return this.#options.protocol.name;
  }

  get providerName(): string {
    return `${this.#options.provider.name}:${this.#options.provider.model}`;
  }

  async run(input: RunInput): Promise<TurnOutcome> {
    const { provider, protocol, tools, context, sessions, pipeline, temperature } = this.#options;
    const { sessionId, userText } = input;

    const turnId = randomUUID();
    const signal = input.signal ?? new AbortController().signal;
    const tracer = this.#options.createTracer(sessionId, turnId);
    const endTurn = tracer.start({ kind: "turn", name: "turn", step: 0 });

    // Under the prompted protocol the raw text carries the tool-call block, so it cannot
    // be shown until it has been parsed. Native replies stream straight through.
    const streamsLive = protocol.name === "native";
    const sink = input.sink ?? noopSink;

    const endContext = tracer.start({ kind: "context", name: "assemble", step: 0 });
    const messages = await context.build({ sessionId, userText });
    endContext({ attributes: { messages: messages.length } });

    const ctx: TurnContext = {
      sessionId,
      turnId,
      startedAt: Date.now(),
      signal,
      trace: tracer,
      step: 0,
      messages,
      finalText: "",
      toolResults: [],
      halt: false,
    };

    /** Only the new messages are persisted — assembled context is rebuilt each turn. */
    const transcript: Message[] = [{ role: "user", content: userText }];
    let usage: Usage | undefined;
    let parseRetries = 0;
    let modelCalls = 0;

    try {
      for (;;) {
        // ctx.step holds the index of the model call this iteration is making, and stays
        // put until the next one begins — so the tool spans that follow are grouped with
        // the call that requested them rather than with the call that comes next.
        ctx.step = modelCalls;

        if (await pipeline.beforeModel(ctx)) break;
        if (signal.aborted) {
          ctx.halt = true;
          ctx.haltReason = "aborted";
          break;
        }

        // A snapshot, not the live array: the loop keeps appending to ctx.messages while
        // the provider is still streaming, and a provider that reads its request after an
        // await would otherwise see messages from later in the turn.
        const request = protocol.prepare(
          { model: provider.model, messages: [...ctx.messages], temperature },
          tools.specs(),
        );

        const reply = await pipeline.runModel(ctx, () =>
          collectAssistantMessage(provider.chat(request, signal), streamsLive ? sink : noopSink),
        );
        modelCalls += 1;

        if (reply.error) throw reply.error;

        usage = reply.usage ?? usage;

        const extracted = protocol.extract(reply.message);
        if (!extracted.ok) {
          // Unreadable tool call. Show the model what went wrong and let it try once more.
          if (parseRetries >= MAX_PARSE_RETRIES) {
            ctx.halt = true;
            ctx.haltReason = `unparseable tool call: ${extracted.reason}`;
            ctx.finalText = reply.message.content;
            if (!streamsLive) sink(ctx.finalText);
            break;
          }
          parseRetries += 1;
          ctx.messages.push(reply.message, {
            role: "user",
            content: retryPrompt(extracted.reason),
          });
          continue;
        }

        const assistant: AssistantMessage = {
          role: "assistant",
          content: extracted.text,
          ...(extracted.calls.length > 0 ? { toolCalls: extracted.calls } : {}),
        };
        ctx.messages.push(assistant);
        transcript.push(assistant);
        ctx.finalText = extracted.text;

        const haltAfterModel = await pipeline.afterModel(ctx);

        if (extracted.calls.length === 0 || haltAfterModel) {
          if (!streamsLive && extracted.calls.length === 0) sink(extracted.text);
          break;
        }

        let haltAfterTools = false;
        for (const call of extracted.calls) {
          await pipeline.beforeTool(ctx, call);

          const result = await pipeline.runTool(ctx, call, () =>
            tools.execute(call, { signal, sessionId, turnId }),
          );

          ctx.toolResults.push(result);
          if (await pipeline.afterTool(ctx, result)) haltAfterTools = true;

          const toolMessage: ToolMessage = {
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: result.content,
            isError: result.isError,
          };
          ctx.messages.push(toolMessage);
          transcript.push(toolMessage);
        }

        // Tool results are always fed back before stopping, so a halting interceptor
        // leaves a transcript the next turn can still read.
        if (haltAfterTools) break;
      }

      endTurn({
        attributes: {
          steps: modelCalls,
          tools: ctx.toolResults.length,
          ...(ctx.haltReason === undefined ? {} : { haltReason: ctx.haltReason }),
        },
      });

      return {
        text: ctx.finalText,
        steps: modelCalls,
        toolResults: ctx.toolResults,
        ...(ctx.haltReason === undefined ? {} : { haltReason: ctx.haltReason }),
        ...(usage === undefined ? {} : { usage }),
      };
    } catch (error) {
      endTurn({
        ok: false,
        attributes: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    } finally {
      // Persist even on failure: a turn that broke is one you will want to read back.
      await sessions.append(sessionId, transcript);
    }
  }
}

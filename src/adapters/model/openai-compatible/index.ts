import { type ChatEvent, type ChatRequest } from "../../../core/types/index.ts";
import { type ModelProvider } from "../../../core/ports/index.ts";
import { parseSse } from "./parse-sse.ts";
import { ToolCallAccumulator } from "./tool-call-accumulator.ts";
import { toWireMessages, toWireTools, type WireChunk } from "./wire.ts";

export interface OpenAiCompatibleOptions {
  /** Base URL including the version segment, e.g. http://localhost:11434/v1 */
  baseUrl: string;
  model: string;
  apiKey: string;
  /**
   * Whether this server can do function calling. Left to configuration because it is a
   * property of the *model*, not the server: the same Ollama instance serves models that
   * can and cannot, and asking the endpoint tells you nothing useful.
   */
  nativeTools?: boolean;
}

/**
 * One adapter for every OpenAI-compatible local server — Ollama, LM Studio, llama.cpp.
 *
 * There is no vendor branching here on purpose: differences between those servers live in
 * the base URL and the model name, so "swap the runtime" stays a config change.
 */
export function openAiCompatibleProvider(options: OpenAiCompatibleOptions): ModelProvider {
  const endpoint = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: "openai-compatible",
    model: options.model,
    capabilities: { nativeTools: options.nativeTools ?? true, streaming: true },

    async *chat(request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
      const response = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: toWireMessages(request.messages),
          temperature: request.temperature,
          stream: true,
          ...(request.tools && request.tools.length > 0
            ? { tools: toWireTools(request.tools) }
            : {}),
          ...(request.stop && request.stop.length > 0 ? { stop: request.stop } : {}),
        }),
      });

      if (!response.ok || !response.body) {
        const detail = await response.text().catch(() => "");
        yield {
          type: "error",
          error: new Error(
            `${options.baseUrl} returned ${String(response.status)} ${response.statusText}${
              detail ? `: ${detail.slice(0, 500)}` : ""
            }`,
          ),
        };
        return;
      }

      const toolCalls = new ToolCallAccumulator();
      let usage: WireChunk["usage"];

      for await (const payload of parseSse(response.body)) {
        const chunk = payload as WireChunk;
        usage = chunk.usage ?? usage;

        const choice = chunk.choices?.[0];
        const content = choice?.delta?.content;
        if (typeof content === "string" && content !== "") {
          yield { type: "text-delta", text: content };
        }
        for (const delta of choice?.delta?.tool_calls ?? []) {
          toolCalls.add(delta);
        }
      }

      for (const call of toolCalls.drain()) {
        yield { type: "tool-call", call };
      }

      yield {
        type: "done",
        ...(usage
          ? {
              usage: {
                ...(usage.prompt_tokens === undefined ? {} : { promptTokens: usage.prompt_tokens }),
                ...(usage.completion_tokens === undefined
                  ? {}
                  : { completionTokens: usage.completion_tokens }),
              },
            }
          : {}),
      };
    },
  };
}

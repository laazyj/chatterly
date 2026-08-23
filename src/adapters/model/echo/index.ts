import { type ChatEvent, type ChatRequest } from "../../../core/types/index.ts";
import { type ModelProvider } from "../../../core/ports/index.ts";
import { decideReply } from "./reply.ts";

export interface EchoProviderOptions {
  /** Delay between characters. Non-zero makes streaming visible; tests pass 0. */
  delayMs?: number;
}

/**
 * A provider that needs no model installed.
 *
 * Its job is to make every path in the loop reachable on a clean checkout — streaming,
 * tool calls under either protocol, and tool results feeding back — so the scaffold is
 * runnable and testable before anyone chooses a runtime.
 */
export function echoProvider(options: EchoProviderOptions = {}): ModelProvider {
  const delayMs = options.delayMs ?? 8;

  return {
    name: "echo",
    model: "echo-1",
    capabilities: { nativeTools: true, streaming: true },

    async *chat(request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
      const reply = decideReply(request);

      if (reply.kind === "tool-call") {
        yield { type: "tool-call", call: { id: "echo-call-1", name: reply.toolName, args: {} } };
        yield { type: "done" };
        return;
      }

      for (const char of reply.text) {
        if (signal.aborted) return;
        if (delayMs > 0) await sleep(delayMs, signal);
        yield { type: "text-delta", text: char };
      }
      // No usage reported: this provider counts characters, and calling those tokens
      // would put a number in the trace that means nothing.
      yield { type: "done" };
    },
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const cleanup = new AbortController();
    const finish = (): void => {
      cleanup.abort();
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        finish();
      },
      { once: true, signal: cleanup.signal },
    );
  });
}

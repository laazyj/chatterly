import { type ChatEvent, type ChatRequest } from "../../src/core/types/index.ts";
import { type ModelProvider } from "../../src/core/ports/index.ts";

export interface FakeProviderOptions {
  /** One entry per expected model call. The last is reused if the loop asks for more. */
  script: ChatEvent[][];
  nativeTools?: boolean;
}

export interface FakeProvider extends ModelProvider {
  /** Every request the loop made, in order. Lets tests assert on what was sent. */
  readonly requests: ChatRequest[];
}

/**
 * A provider driven by a scripted list of event batches.
 *
 * This is the fixture the loop tests are built on: no network, no timing, and the exact
 * sequence of tool calls and answers is stated in the test rather than coaxed out of a
 * model.
 */
export function fakeProvider(options: FakeProviderOptions): FakeProvider {
  const requests: ChatRequest[] = [];
  let call = 0;

  return {
    name: "fake",
    model: "fake-1",
    capabilities: { nativeTools: options.nativeTools ?? true, streaming: true },
    requests,

    // eslint-disable-next-line @typescript-eslint/require-await
    async *chat(request: ChatRequest): AsyncIterable<ChatEvent> {
      requests.push(request);
      const index = Math.min(call, options.script.length - 1);
      call += 1;
      for (const event of options.script[index] ?? []) {
        yield event;
      }
    },
  };
}

/** Convenience: a batch that streams `text` in one delta and finishes. */
export function says(text: string): ChatEvent[] {
  return [{ type: "text-delta", text }, { type: "done" }];
}

/** Convenience: a batch that requests one native tool call and finishes. */
export function callsTool(name: string, args: unknown = {}): ChatEvent[] {
  return [{ type: "tool-call", call: { id: `${name}-1`, name, args } }, { type: "done" }];
}

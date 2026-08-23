import { type StreamSink } from "../types/stream-sink.ts";
import { type TurnOutcome } from "../types/turn-outcome.ts";

export interface RunInput {
  sessionId: string;
  userText: string;
  /** Where to stream assistant text. Omit to collect silently, as evals do. */
  sink?: StreamSink;
  signal?: AbortSignal;
}

/**
 * The inbound (driving) port: one user turn in, one outcome out.
 *
 * Driving adapters — the REPL, the eval runner, the tests — depend on this rather than on
 * `Agent`, which is what lets the same core be driven by a person, a script or a test
 * without any of them knowing how a turn is executed.
 */
export interface ConversationPort {
  run(input: RunInput): Promise<TurnOutcome>;
}

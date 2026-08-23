import { type Message } from "../../core/types/index.ts";

/**
 * Short-term memory: the literal transcript of a conversation.
 *
 * Append-only by design — a turn is a fact that happened, and rewriting history is how
 * you lose the ability to replay a session into an eval.
 */
export interface SessionStore {
  append(sessionId: string, messages: Message[]): Promise<void>;
  load(sessionId: string): Promise<Message[]>;
  list(): Promise<string[]>;
}

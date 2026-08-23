import { type Message } from "./message.ts";

export interface ContextRequest {
  sessionId: string;
  userText: string;
}

/**
 * Builds the transcript a turn starts from.
 *
 * This is the only place memory and retrieval touch the prompt, which is what keeps the
 * agent loop ignorant of both. Implementing a memory or RAG spike means changing what
 * this is given, never changing the loop.
 */
export interface ContextAssembler {
  build(request: ContextRequest): Promise<Message[]>;
}

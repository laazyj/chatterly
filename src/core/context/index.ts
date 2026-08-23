import { type MemoryStore, type SessionStore } from "../ports/index.ts";
import { type Retriever } from "../ports/index.ts";
import { type ContextAssembler, type Message } from "../types/index.ts";
import { renderDocuments } from "./render-documents.ts";
import { renderRecollections } from "./render-recollections.ts";

export { renderDocuments } from "./render-documents.ts";
export { renderRecollections } from "./render-recollections.ts";

export interface ContextAssemblerOptions {
  systemPrompt: string;
  sessions: SessionStore;
  memory: MemoryStore;
  retriever: Retriever;
  recallLimit?: number;
  retrieveLimit?: number;
}

/**
 * Assembles system prompt, recalled memories, retrieved documents, prior transcript and
 * the new user message into the starting messages for a turn.
 *
 * Memory and retrieval are queried concurrently: they are independent, and on a local
 * setup either could be the slow one.
 */
export function createContextAssembler(options: ContextAssemblerOptions): ContextAssembler {
  const { systemPrompt, sessions, memory, retriever } = options;
  const recallLimit = options.recallLimit ?? 5;
  const retrieveLimit = options.retrieveLimit ?? 4;

  return {
    async build({ sessionId, userText }) {
      const [history, recollections, documents] = await Promise.all([
        sessions.load(sessionId),
        memory.recall(userText, recallLimit),
        retriever.retrieve(userText, retrieveLimit),
      ]);

      const system = [systemPrompt, renderRecollections(recollections), renderDocuments(documents)]
        .filter((section) => section !== "")
        .join("\n\n");

      const messages: Message[] = [
        { role: "system", content: system },
        ...history,
        { role: "user", content: userText },
      ];

      return messages;
    },
  };
}

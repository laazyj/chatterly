import { type Interceptor, type Message } from "../types/index.ts";

const length = (message: Message): number => message.content.length;

/**
 * Keeps the working transcript under a character budget before each model call.
 *
 * Characters, not tokens, and oldest-first eviction: this is the honest placeholder for
 * real compaction, not an implementation of it. A memory spike replaces this interceptor
 * with one that summarises what it evicts instead of discarding it.
 *
 * System messages are never evicted, nor is the most recent message. Leading orphan tool
 * results are dropped afterwards — a tool result whose requesting assistant message has
 * been evicted is rejected by strict OpenAI-compatible servers.
 */
export function transcriptTrimInterceptor(budgetChars: number): Interceptor {
  return {
    name: "transcript-trim",
    beforeModel(ctx) {
      let total = ctx.messages.reduce((sum, message) => sum + length(message), 0);
      if (total <= budgetChars) return;

      const system = ctx.messages.filter((message) => message.role === "system");
      const rest = ctx.messages.filter((message) => message.role !== "system");

      while (total > budgetChars && rest.length > 1) {
        const dropped = rest.shift();
        if (!dropped) break;
        total -= length(dropped);
      }
      while (rest.length > 1 && rest[0]?.role === "tool") {
        const orphan = rest.shift();
        if (!orphan) break;
        total -= length(orphan);
      }

      ctx.messages = [...system, ...rest];
    },
  };
}

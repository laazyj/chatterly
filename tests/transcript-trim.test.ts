import { describe, expect, it } from "vitest";
import { transcriptTrimInterceptor } from "../src/core/interceptors/index.ts";
import { type Message, type TurnContext } from "../src/core/types/index.ts";
import { nullTracer } from "../src/adapters/tracing/null-tracer.ts";

function contextWith(messages: Message[]): TurnContext {
  return {
    sessionId: "s",
    turnId: "t",
    startedAt: 0,
    signal: new AbortController().signal,
    trace: nullTracer,
    step: 0,
    messages,
    finalText: "",
    toolResults: [],
    halt: false,
  };
}

const user = (content: string): Message => ({ role: "user", content });

describe("transcript trim interceptor", () => {
  it("leaves a transcript inside the budget untouched", async () => {
    const messages = [user("a"), user("b")];
    const ctx = contextWith(messages);

    await transcriptTrimInterceptor(100).beforeModel?.(ctx);

    expect(ctx.messages).toBe(messages);
  });

  it("evicts oldest first once over budget", async () => {
    const ctx = contextWith([user("1111"), user("2222"), user("3333")]);

    await transcriptTrimInterceptor(8).beforeModel?.(ctx);

    expect(ctx.messages.map((message) => message.content)).toEqual(["2222", "3333"]);
  });

  it("never evicts the system message", async () => {
    const ctx = contextWith([
      { role: "system", content: "system prompt that is quite long" },
      user("1111"),
      user("2222"),
    ]);

    await transcriptTrimInterceptor(10).beforeModel?.(ctx);

    expect(ctx.messages[0]?.role).toBe("system");
    expect(ctx.messages.at(-1)?.content).toBe("2222");
  });

  it("keeps the most recent message even when it alone exceeds the budget", async () => {
    const ctx = contextWith([user("old"), user("a very long final message")]);

    await transcriptTrimInterceptor(5).beforeModel?.(ctx);

    expect(ctx.messages.map((message) => message.content)).toEqual(["a very long final message"]);
  });

  it("drops a tool result whose requesting assistant message was evicted", async () => {
    const ctx = contextWith([
      user("something old and long enough to evict"),
      { role: "tool", toolCallId: "1", name: "clock", content: "12:00", isError: false },
      user("what now?"),
    ]);

    await transcriptTrimInterceptor(20).beforeModel?.(ctx);

    expect(ctx.messages.some((message) => message.role === "tool")).toBe(false);
  });
});

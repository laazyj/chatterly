import { describe, expect, it } from "vitest";
import { z } from "zod";
import { stepBudgetInterceptor } from "../src/core/interceptors/index.ts";
import { promptedProtocol } from "../src/tools/protocols/prompted/index.ts";
import { defineTool } from "../src/tools/define-tool.ts";
import { buildAgent, memorySessionStore } from "./helpers/build-agent.ts";
import { callsTool, fakeProvider, says } from "./helpers/fake-provider.ts";

const clock = defineTool({
  name: "clock",
  description: "Tells the time.",
  parameters: z.object({}),
  execute: () => "12:00",
});

describe("agent loop", () => {
  it("runs a tool call and feeds the result back for a final answer", async () => {
    const provider = fakeProvider({
      script: [callsTool("clock"), says("It is 12:00.")],
    });
    const agent = buildAgent({ provider, tools: [clock] });

    const outcome = await agent.run({ sessionId: "s", userText: "what time is it?" });

    expect(outcome.text).toBe("It is 12:00.");
    expect(outcome.steps).toBe(2);
    expect(outcome.toolResults).toMatchObject([
      { name: "clock", content: "12:00", isError: false },
    ]);

    // The second request must carry the tool result, or the model is answering blind.
    const second = provider.requests[1];
    expect(second?.messages.at(-1)).toMatchObject({ role: "tool", content: "12:00" });
  });

  it("answers in one step when no tool is needed", async () => {
    const agent = buildAgent({
      provider: fakeProvider({ script: [says("Hello.")] }),
      tools: [clock],
    });

    const outcome = await agent.run({ sessionId: "s", userText: "hi" });

    expect(outcome.text).toBe("Hello.");
    expect(outcome.steps).toBe(1);
    expect(outcome.toolResults).toEqual([]);
  });

  it("stops a model that calls tools forever, at the configured budget", async () => {
    const agent = buildAgent({
      provider: fakeProvider({ script: [callsTool("clock")] }),
      tools: [clock],
      interceptors: [stepBudgetInterceptor(3)],
    });

    const outcome = await agent.run({ sessionId: "s", userText: "loop please" });

    expect(outcome.steps).toBe(3);
    expect(outcome.haltReason).toContain("step budget");
  });

  it("streams text to the sink as it arrives under the native protocol", async () => {
    const chunks: string[] = [];
    const agent = buildAgent({
      provider: fakeProvider({
        script: [
          [
            { type: "text-delta", text: "Hel" },
            { type: "text-delta", text: "lo." },
            { type: "done" },
          ],
        ],
      }),
    });

    await agent.run({ sessionId: "s", userText: "hi", sink: (delta) => chunks.push(delta) });

    expect(chunks).toEqual(["Hel", "lo."]);
  });

  it("does not stream a prompted tool-call block to the user", async () => {
    const chunks: string[] = [];
    const agent = buildAgent({
      provider: fakeProvider({
        script: [says('```json\n{"tool": "clock", "args": {}}\n```'), says("It is 12:00.")],
        nativeTools: false,
      }),
      protocol: promptedProtocol(),
      tools: [clock],
    });

    const outcome = await agent.run({
      sessionId: "s",
      userText: "what time is it?",
      sink: (delta) => chunks.push(delta),
    });

    expect(chunks.join("")).toBe("It is 12:00.");
    expect(chunks.join("")).not.toContain("{");
    expect(outcome.toolResults).toHaveLength(1);
  });

  it("gives the model one chance to fix an unreadable tool call", async () => {
    const provider = fakeProvider({
      script: [says('```json\n{"tool": "clock" broken }\n```'), says("Sorry — it is 12:00.")],
      nativeTools: false,
    });
    const agent = buildAgent({ provider, protocol: promptedProtocol(), tools: [clock] });

    const outcome = await agent.run({ sessionId: "s", userText: "what time is it?" });

    expect(outcome.text).toBe("Sorry — it is 12:00.");
    expect(provider.requests[1]?.messages.at(-1)?.content).toContain("not valid JSON");
  });

  it("persists the user, assistant and tool messages of a turn", async () => {
    const sessions = memorySessionStore();
    const agent = buildAgent({
      provider: fakeProvider({ script: [callsTool("clock"), says("It is 12:00.")] }),
      tools: [clock],
      sessions,
    });

    await agent.run({ sessionId: "s", userText: "what time is it?" });

    expect(sessions.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
  });

  it("surfaces a provider error event as a thrown error", async () => {
    const agent = buildAgent({
      provider: fakeProvider({
        script: [[{ type: "error", error: new Error("connection refused") }]],
      }),
    });

    await expect(agent.run({ sessionId: "s", userText: "hi" })).rejects.toThrow(
      "connection refused",
    );
  });
});

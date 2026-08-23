import { describe, expect, it } from "vitest";
import { createContextAssembler } from "../src/core/context/index.ts";
import { nullMemoryStore } from "../src/adapters/memory/null-memory-store.ts";
import { nullRetriever } from "../src/adapters/retrieval/null-retriever.ts";
import { type MemoryStore } from "../src/core/ports/index.ts";
import { type Retriever } from "../src/core/ports/index.ts";
import { memorySessionStore } from "./helpers/build-agent.ts";

function assembler(overrides: { memory?: MemoryStore; retriever?: Retriever } = {}) {
  return createContextAssembler({
    systemPrompt: "Be brief.",
    sessions: memorySessionStore(),
    memory: overrides.memory ?? nullMemoryStore(),
    retriever: overrides.retriever ?? nullRetriever(),
  });
}

describe("context assembler", () => {
  it("produces system prompt then user message when both seams are empty", async () => {
    const messages = await assembler().build({ sessionId: "s", userText: "hi" });

    expect(messages).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "hi" },
    ]);
  });

  it("places prior history between the system prompt and the new message", async () => {
    const sessions = memorySessionStore();
    await sessions.append("s", [{ role: "user", content: "earlier" }]);

    const messages = await createContextAssembler({
      systemPrompt: "Be brief.",
      sessions,
      memory: nullMemoryStore(),
      retriever: nullRetriever(),
    }).build({ sessionId: "s", userText: "now" });

    expect(messages.map((message) => message.content)).toEqual(["Be brief.", "earlier", "now"]);
  });

  // This is the extension smoke test: implementing a seam must change the prompt with no
  // change to the agent loop.
  it("puts retrieved documents into the system prompt", async () => {
    const retriever: Retriever = {
      name: "fake",
      retrieve: () =>
        Promise.resolve([
          { id: "1", text: "Chatterly ships with one example tool.", source: "README", score: 1 },
        ]),
    };

    const messages = await assembler({ retriever }).build({ sessionId: "s", userText: "hi" });

    expect(messages[0]?.content).toContain("Reference material");
    expect(messages[0]?.content).toContain("[1] README");
    expect(messages[0]?.content).toContain("one example tool");
  });

  it("puts recalled memories into the system prompt", async () => {
    const memory: MemoryStore = {
      name: "fake",
      recall: () => Promise.resolve([{ id: "1", text: "Prefers short answers.", createdAt: 0 }]),
      remember: () => Promise.reject(new Error("not needed")),
    };

    const messages = await assembler({ memory }).build({ sessionId: "s", userText: "hi" });

    expect(messages[0]?.content).toContain("What you remember");
    expect(messages[0]?.content).toContain("Prefers short answers.");
  });

  it("passes the user's message as the query to both seams", async () => {
    const queries: string[] = [];
    const retriever: Retriever = {
      name: "spy",
      retrieve: (query) => {
        queries.push(query);
        return Promise.resolve([]);
      },
    };
    const memory: MemoryStore = {
      name: "spy",
      recall: (query) => {
        queries.push(query);
        return Promise.resolve([]);
      },
      remember: () => Promise.reject(new Error("not needed")),
    };

    await assembler({ memory, retriever }).build({ sessionId: "s", userText: "what time is it?" });

    expect(queries).toEqual(["what time is it?", "what time is it?"]);
  });
});

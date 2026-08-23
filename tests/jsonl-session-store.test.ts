import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Message } from "../src/core/types/index.ts";
import { jsonlSessionStore } from "../src/adapters/memory/jsonl-session-store.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chatterly-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const conversation: Message[] = [
  { role: "user", content: "what time is it?" },
  { role: "assistant", content: "", toolCalls: [{ id: "1", name: "clock", args: {} }] },
  { role: "tool", toolCallId: "1", name: "clock", content: "12:00", isError: false },
  { role: "assistant", content: "It is 12:00." },
];

describe("jsonl session store", () => {
  it("round-trips a conversation including tool calls", async () => {
    const store = jsonlSessionStore(dir);

    await store.append("s1", conversation);

    expect(await store.load("s1")).toEqual(conversation);
  });

  it("appends across calls rather than overwriting", async () => {
    const store = jsonlSessionStore(dir);

    await store.append("s1", [{ role: "user", content: "first" }]);
    await store.append("s1", [{ role: "user", content: "second" }]);

    expect((await store.load("s1")).map((message) => message.content)).toEqual(["first", "second"]);
  });

  it("returns nothing for a session that does not exist", async () => {
    expect(await jsonlSessionStore(dir).load("missing")).toEqual([]);
  });

  it("keeps what parsed when the last write was truncated", async () => {
    const store = jsonlSessionStore(dir);
    await store.append("s1", [{ role: "user", content: "intact" }]);
    await writeFile(join(dir, "sessions", "s1.jsonl"), '{"role":"user","con', {
      flag: "a",
    });

    const loaded = await store.load("s1");

    expect(loaded).toEqual([{ role: "user", content: "intact" }]);
  });

  it("lists sessions and ignores unrelated files", async () => {
    const store = jsonlSessionStore(dir);
    await store.append("b", [{ role: "user", content: "x" }]);
    await store.append("a", [{ role: "user", content: "x" }]);
    await writeFile(join(dir, "sessions", "notes.txt"), "ignore me");

    expect(await store.list()).toEqual(["a", "b"]);
  });

  it("writes nothing for an empty batch", async () => {
    const store = jsonlSessionStore(dir);

    await store.append("s1", []);

    expect(await store.list()).toEqual([]);
  });
});

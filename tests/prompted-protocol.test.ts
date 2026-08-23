import { describe, expect, it } from "vitest";
import { type ExtractResult } from "../src/core/types/index.ts";
import {
  parseToolCalls,
  promptedProtocol,
  TOOL_MANUAL_HEADER,
} from "../src/tools/protocols/prompted/index.ts";

/** Narrows to the success branch, failing the test with the reason if it is not one. */
function ok(result: ExtractResult): {
  text: string;
  calls: { name: string; args: unknown; id: string }[];
} {
  if (!result.ok) throw new Error(`expected a successful extract, got: ${result.reason}`);
  return result;
}

describe("prompted protocol parsing", () => {
  it("reads a clean fenced tool call and strips it from the visible text", () => {
    const { text, calls } = ok(parseToolCalls('```json\n{"tool": "clock", "args": {}}\n```'));

    expect(calls).toEqual([{ id: "call-1", name: "clock", args: {} }]);
    expect(text).toBe("");
  });

  it("accepts the name/arguments spelling small models often emit", () => {
    const { calls } = ok(
      parseToolCalls('```json\n{"name": "clock", "arguments": {"timeZone": "Europe/London"}}\n```'),
    );

    expect(calls).toEqual([{ id: "call-1", name: "clock", args: { timeZone: "Europe/London" } }]);
  });

  it("repairs a trailing comma and prose leaking into the block", () => {
    const { calls } = ok(
      parseToolCalls('```json\nSure! {"tool": "clock", "args": {"timeZone": "UTC",}}\n```'),
    );

    expect(calls).toEqual([{ id: "call-1", name: "clock", args: { timeZone: "UTC" } }]);
  });

  it("reports failure as a value when a block means to be a call but cannot be read", () => {
    const result = parseToolCalls('```json\n{"tool": "clock" args }\n```');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("not valid JSON");
    expect(result.raw).toContain("clock");
  });

  it("leaves a JSON answer alone when it is not a tool call", () => {
    const payload = '```json\n{"answer": 42}\n```';
    const { text, calls } = ok(parseToolCalls(payload));

    expect(calls).toEqual([]);
    expect(text).toBe(payload);
  });

  it("treats plain prose as an answer", () => {
    const { text, calls } = ok(parseToolCalls("It is half past two."));

    expect(calls).toEqual([]);
    expect(text).toBe("It is half past two.");
  });
});

describe("prompted protocol preparation", () => {
  it("appends the tool manual to the existing system message", () => {
    const request = promptedProtocol().prepare(
      {
        model: "m",
        temperature: 0,
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "hi" },
        ],
      },
      [{ name: "clock", description: "Tells the time.", parameters: { type: "object" } }],
    );

    const system = request.messages[0];
    expect(system?.role).toBe("system");
    expect(system?.content).toContain("Be brief.");
    expect(system?.content).toContain(TOOL_MANUAL_HEADER);
    expect(system?.content).toContain("### clock");
    // Tools must not also go on the wire, or a native-capable server sees them twice.
    expect(request.tools).toBeUndefined();
  });

  it("leaves the request untouched when there are no tools", () => {
    const original = {
      model: "m",
      temperature: 0,
      messages: [{ role: "user" as const, content: "hi" }],
    };

    expect(promptedProtocol().prepare(original, [])).toBe(original);
  });
});

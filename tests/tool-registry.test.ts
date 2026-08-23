import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineTool } from "../src/tools/define-tool.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { toToolSpec } from "../src/tools/to-tool-spec.ts";

const greet = defineTool({
  name: "greet",
  description: "Greets someone.",
  parameters: z.object({
    name: z.string().describe("Who to greet"),
    excited: z.boolean().optional(),
  }),
  execute({ name, excited }) {
    return `Hello ${name}${excited === true ? "!" : "."}`;
  },
});

const context = { signal: new AbortController().signal, sessionId: "s", turnId: "t" };

describe("tool registry", () => {
  it("executes a valid call", async () => {
    const registry = new ToolRegistry({ timeoutMs: 1_000 }).register(greet);

    const result = await registry.execute(
      { id: "1", name: "greet", args: { name: "Ada", excited: true } },
      context,
    );

    expect(result).toMatchObject({
      callId: "1",
      name: "greet",
      content: "Hello Ada!",
      isError: false,
    });
  });

  it("rejects arguments that fail the schema, naming the offending field", async () => {
    const registry = new ToolRegistry({ timeoutMs: 1_000 }).register(greet);

    const result = await registry.execute({ id: "1", name: "greet", args: { name: 42 } }, context);

    expect(result.isError).toBe(true);
    expect(result.content).toContain("name");
  });

  it("reports unknown tools with the list of real ones", async () => {
    const registry = new ToolRegistry({ timeoutMs: 1_000 }).register(greet);

    const result = await registry.execute({ id: "1", name: "nope", args: {} }, context);

    expect(result.isError).toBe(true);
    expect(result.content).toContain("greet");
  });

  it("turns a thrown handler error into an error result rather than propagating", async () => {
    const registry = new ToolRegistry({ timeoutMs: 1_000 }).register(
      defineTool({
        name: "boom",
        description: "Always fails.",
        parameters: z.object({}),
        execute() {
          throw new Error("kaboom");
        },
      }),
    );

    const result = await registry.execute({ id: "1", name: "boom", args: {} }, context);

    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain("kaboom");
  });

  it("cuts off a tool that ignores its signal", async () => {
    const registry = new ToolRegistry({ timeoutMs: 20 }).register(
      defineTool({
        name: "hang",
        description: "Never returns in time.",
        parameters: z.object({}),
        async execute() {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return "too late";
        },
      }),
    );

    const result = await registry.execute({ id: "1", name: "hang", args: {} }, context);

    expect(result.isError).toBe(true);
    expect(result.content).toContain("timed out");
  });

  it("refuses to register the same name twice", () => {
    const registry = new ToolRegistry({ timeoutMs: 1_000 }).register(greet);

    expect(() => registry.register(greet)).toThrow(/already registered/);
  });
});

describe("zod to JSON Schema derivation", () => {
  it("produces an object schema the wire can carry", () => {
    const spec = toToolSpec(greet);

    expect(spec.name).toBe("greet");
    expect(spec.parameters).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string", description: "Who to greet" },
        excited: { type: "boolean" },
      },
      required: ["name"],
    });
  });
});

import { describe, expect, it } from "vitest";
import { Pipeline } from "../src/core/pipeline.ts";
import { type Interceptor, type ModelReply, type TurnContext } from "../src/core/types/index.ts";
import { nullTracer } from "../src/adapters/tracing/null-tracer.ts";

function turnContext(): TurnContext {
  return {
    sessionId: "s",
    turnId: "t",
    startedAt: 0,
    signal: new AbortController().signal,
    trace: nullTracer,
    step: 0,
    messages: [],
    finalText: "",
    toolResults: [],
    halt: false,
  };
}

function reply(text: string): ModelReply {
  return { message: { role: "assistant", content: text } };
}

function recorder(name: string, log: string[]): Interceptor {
  return {
    name,
    beforeModel: () => void log.push(`${name}:before`),
    afterModel: () => void log.push(`${name}:after`),
  };
}

describe("interceptor pipeline", () => {
  it("runs before-hooks in order and after-hooks in reverse", async () => {
    const log: string[] = [];
    const pipeline = new Pipeline([recorder("outer", log), recorder("inner", log)]);
    const ctx = turnContext();

    await pipeline.beforeModel(ctx);
    await pipeline.afterModel(ctx);

    expect(log).toEqual(["outer:before", "inner:before", "inner:after", "outer:after"]);
  });

  it("reports a halt requested by any interceptor", async () => {
    const pipeline = new Pipeline([
      {
        name: "stopper",
        beforeModel(ctx) {
          ctx.halt = true;
          ctx.haltReason = "because";
        },
      },
    ]);
    const ctx = turnContext();

    expect(await pipeline.beforeModel(ctx)).toBe(true);
    expect(ctx.haltReason).toBe("because");
  });

  it("awaits async hooks in sequence rather than interleaving them", async () => {
    const log: string[] = [];
    const slow = (name: string, ms: number): Interceptor => ({
      name,
      async beforeModel() {
        await new Promise((resolve) => setTimeout(resolve, ms));
        log.push(name);
      },
    });

    // The slower hook is registered first: interleaved execution would finish it last.
    await new Pipeline([slow("first", 20), slow("second", 1)]).beforeModel(turnContext());

    expect(log).toEqual(["first", "second"]);
  });

  it("skips interceptors that do not implement a hook", async () => {
    const pipeline = new Pipeline([{ name: "empty" }]);

    expect(await pipeline.beforeModel(turnContext())).toBe(false);
  });
});

describe("middleware chain", () => {
  it("wraps the invocation outermost-first, matching before-hook order", async () => {
    const log: string[] = [];
    const wrap = (name: string): Interceptor => ({
      name,
      aroundModel: async (_ctx, next) => {
        log.push(`${name}:enter`);
        const reply = await next();
        log.push(`${name}:exit`);
        return reply;
      },
    });

    await new Pipeline([wrap("outer"), wrap("inner")]).runModel(turnContext(), () => {
      log.push("invoke");
      return Promise.resolve(reply("hi"));
    });

    expect(log).toEqual(["outer:enter", "inner:enter", "invoke", "inner:exit", "outer:exit"]);
  });

  it("lets a link retry the call — which before/after hooks cannot express", async () => {
    let attempts = 0;
    const retryOnce: Interceptor = {
      name: "retry",
      aroundModel: async (_ctx, next) => {
        const first = await next();
        return first.error ? next() : first;
      },
    };

    const outcome = await new Pipeline([retryOnce]).runModel(turnContext(), () => {
      attempts += 1;
      return Promise.resolve(
        attempts === 1 ? { ...reply(""), error: new Error("flaked") } : reply("second time"),
      );
    });

    expect(attempts).toBe(2);
    expect(outcome.message.content).toBe("second time");
    expect(outcome.error).toBeUndefined();
  });

  it("lets a link skip the call entirely and serve its own result", async () => {
    let invoked = false;
    const cached: Interceptor = {
      name: "cache",
      aroundModel: () => Promise.resolve(reply("from cache")),
    };

    const outcome = await new Pipeline([cached]).runModel(turnContext(), () => {
      invoked = true;
      return Promise.resolve(reply("from model"));
    });

    expect(invoked).toBe(false);
    expect(outcome.message.content).toBe("from cache");
  });

  it("passes the call through every aroundTool link", async () => {
    const seen: string[] = [];
    const spy: Interceptor = {
      name: "spy",
      aroundTool: (_ctx, call, next) => {
        seen.push(call.name);
        return next();
      },
    };
    const call = { id: "1", name: "clock", args: {} };

    const result = await new Pipeline([spy]).runTool(turnContext(), call, () =>
      Promise.resolve({
        callId: "1",
        name: "clock",
        content: "12:00",
        isError: false,
        durationMs: 1,
      }),
    );

    expect(seen).toEqual(["clock"]);
    expect(result.content).toBe("12:00");
  });

  it("invokes directly when no interceptor declares an around hook", async () => {
    const outcome = await new Pipeline([{ name: "inert" }]).runModel(turnContext(), () =>
      Promise.resolve(reply("straight through")),
    );

    expect(outcome.message.content).toBe("straight through");
  });
});

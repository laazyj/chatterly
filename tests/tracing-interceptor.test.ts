import { describe, expect, it } from "vitest";
import { tracingInterceptor } from "../src/core/interceptors/index.ts";
import { type Span, type TurnContext } from "../src/core/types/index.ts";
import { type Tracer } from "../src/core/ports/index.ts";

type RecordedSpan = Pick<Span, "kind" | "name" | "step"> & {
  ok: boolean;
  attributes: Record<string, unknown>;
};

function recordingTracer(): { tracer: Tracer; spans: RecordedSpan[] } {
  const spans: RecordedSpan[] = [];
  return {
    spans,
    tracer: {
      start(seed) {
        return (outcome) => {
          spans.push({ ...seed, ok: outcome?.ok ?? true, attributes: outcome?.attributes ?? {} });
        };
      },
    },
  };
}

function contextWith(trace: Tracer, step = 0): TurnContext {
  return {
    sessionId: "s",
    turnId: "t",
    startedAt: 0,
    signal: new AbortController().signal,
    trace,
    step,
    messages: [],
    finalText: "",
    toolResults: [],
    halt: false,
  };
}

describe("tracing interceptor", () => {
  it("records a model span stamped with the current step", async () => {
    const { tracer, spans } = recordingTracer();

    await tracingInterceptor().aroundModel?.(contextWith(tracer, 2), () =>
      Promise.resolve({ message: { role: "assistant", content: "hello" } }),
    );

    expect(spans).toMatchObject([{ kind: "model", step: 2, ok: true }]);
    expect(spans[0]?.attributes).toMatchObject({ chars: 5, calls: 0 });
  });

  // The reason `around` exists: split before/after hooks lose the span on failure,
  // which is exactly the call you most want in the trace.
  it("closes the span and rethrows when the model call throws", async () => {
    const { tracer, spans } = recordingTracer();

    await expect(
      tracingInterceptor().aroundModel?.(contextWith(tracer), () =>
        Promise.reject(new Error("connection refused")),
      ),
    ).rejects.toThrow("connection refused");

    expect(spans).toMatchObject([{ kind: "model", ok: false }]);
    expect(spans[0]?.attributes).toMatchObject({ error: "connection refused" });
  });

  it("marks a model span not-ok when the provider reports an error event", async () => {
    const { tracer, spans } = recordingTracer();

    await tracingInterceptor().aroundModel?.(contextWith(tracer), () =>
      Promise.resolve({
        message: { role: "assistant", content: "" },
        error: new Error("bad gateway"),
      }),
    );

    expect(spans[0]?.ok).toBe(false);
  });

  it("records a tool span named after the tool, carrying its arguments", async () => {
    const { tracer, spans } = recordingTracer();
    const call = { id: "1", name: "clock", args: { timeZone: "UTC" } };

    await tracingInterceptor().aroundTool?.(contextWith(tracer), call, () =>
      Promise.resolve({
        callId: "1",
        name: "clock",
        content: "12:00",
        isError: false,
        durationMs: 3,
      }),
    );

    expect(spans).toMatchObject([{ kind: "tool", name: "clock", ok: true }]);
    expect(spans[0]?.attributes).toMatchObject({ args: { timeZone: "UTC" }, durationMs: 3 });
  });

  it("marks a tool span not-ok when the tool returned an error result", async () => {
    const { tracer, spans } = recordingTracer();

    await tracingInterceptor().aroundTool?.(
      contextWith(tracer),
      { id: "1", name: "x", args: {} },
      () =>
        Promise.resolve({ callId: "1", name: "x", content: "boom", isError: true, durationMs: 1 }),
    );

    expect(spans[0]?.ok).toBe(false);
  });
});

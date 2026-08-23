import { type Interceptor } from "../types/index.ts";

/**
 * Records a span around every model and tool call.
 *
 * This is why `around` exists. Timing a call means holding it — starting a clock before
 * and stopping it after, including when it throws. Split before/after hooks cannot do
 * that: the "after" never runs on failure, so the span leaks and the trace quietly loses
 * exactly the calls you most wanted to see.
 *
 * Keeping it here rather than in the loop also means tracing is removable: drop this
 * interceptor and the agent stops emitting model and tool spans, with no edit to agent.ts.
 */
export function tracingInterceptor(): Interceptor {
  return {
    name: "tracing",

    async aroundModel(ctx, next) {
      const end = ctx.trace.start({ kind: "model", name: "model", step: ctx.step });
      try {
        const reply = await next();
        end({
          ok: reply.error === undefined,
          attributes: {
            chars: reply.message.content.length,
            calls: reply.message.toolCalls?.length ?? 0,
            ...(reply.usage ?? {}),
            ...(reply.error ? { error: reply.error.message } : {}),
          },
        });
        return reply;
      } catch (error) {
        end({ ok: false, attributes: { error: describe(error) } });
        throw error;
      }
    },

    async aroundTool(ctx, call, next) {
      const end = ctx.trace.start({ kind: "tool", name: call.name, step: ctx.step });
      try {
        const result = await next();
        end({
          ok: !result.isError,
          attributes: { args: call.args, durationMs: result.durationMs },
        });
        return result;
      } catch (error) {
        end({ ok: false, attributes: { args: call.args, error: describe(error) } });
        throw error;
      }
    },
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

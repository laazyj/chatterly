import {
  type Interceptor,
  type ModelReply,
  type Next,
  type ToolCall,
  type ToolResult,
  type TurnContext,
} from "./types/index.ts";

/**
 * Runs the interceptors around one turn.
 *
 * Ordering is onion-shaped and consistent across both mechanisms: the first interceptor
 * registered is the outermost. Its `beforeModel` runs first, its `aroundModel` wraps every
 * later one, and its `afterModel` runs last.
 *
 * Hooks are awaited in sequence, never in parallel: they mutate shared context, and
 * concurrent mutation would make ordering — the one guarantee this class offers —
 * meaningless.
 *
 * The `before*`/`after*` methods return the post-hook halt state rather than leaving the
 * caller to re-read `ctx.halt`. That is not sugar: a caller reading the field back cannot
 * be checked by the compiler, because mutation through an interceptor is invisible to
 * control-flow analysis.
 */
export class Pipeline {
  readonly #interceptors: Interceptor[];

  constructor(interceptors: Interceptor[] = []) {
    this.#interceptors = [...interceptors];
  }

  use(interceptor: Interceptor): this {
    this.#interceptors.push(interceptor);
    return this;
  }

  get names(): string[] {
    return this.#interceptors.map((interceptor) => interceptor.name);
  }

  /** @returns whether an interceptor asked the loop to stop. */
  async beforeModel(ctx: TurnContext): Promise<boolean> {
    for (const interceptor of this.#interceptors) {
      await interceptor.beforeModel?.(ctx);
    }
    return ctx.halt;
  }

  /** @returns whether an interceptor asked the loop to stop. */
  async afterModel(ctx: TurnContext): Promise<boolean> {
    for (const interceptor of [...this.#interceptors].reverse()) {
      await interceptor.afterModel?.(ctx);
    }
    return ctx.halt;
  }

  /** @returns whether an interceptor asked the loop to stop. */
  async beforeTool(ctx: TurnContext, call: ToolCall): Promise<boolean> {
    for (const interceptor of this.#interceptors) {
      await interceptor.beforeTool?.(ctx, call);
    }
    return ctx.halt;
  }

  /** @returns whether an interceptor asked the loop to stop. */
  async afterTool(ctx: TurnContext, result: ToolResult): Promise<boolean> {
    for (const interceptor of [...this.#interceptors].reverse()) {
      await interceptor.afterTool?.(ctx, result);
    }
    return ctx.halt;
  }

  /** Invokes the model call through every `aroundModel` link, outermost first. */
  runModel(ctx: TurnContext, invoke: Next<ModelReply>): Promise<ModelReply> {
    const chain = this.#interceptors.reduceRight<Next<ModelReply>>((next, interceptor) => {
      const around = interceptor.aroundModel;
      return around ? () => around(ctx, next) : next;
    }, invoke);

    return chain();
  }

  /** Invokes one tool call through every `aroundTool` link, outermost first. */
  runTool(ctx: TurnContext, call: ToolCall, invoke: Next<ToolResult>): Promise<ToolResult> {
    const chain = this.#interceptors.reduceRight<Next<ToolResult>>((next, interceptor) => {
      const around = interceptor.aroundTool;
      return around ? () => around(ctx, call, next) : next;
    }, invoke);

    return chain();
  }
}

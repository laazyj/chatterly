import { type Interceptor } from "../types/index.ts";

/**
 * Stops a model that keeps calling tools forever.
 *
 * This lives in an interceptor rather than the loop so the termination policy is
 * replaceable: a spike wanting a token budget or a wall-clock deadline swaps this out
 * without touching agent.ts.
 */
export function stepBudgetInterceptor(maxSteps: number): Interceptor {
  return {
    name: "step-budget",
    beforeModel(ctx) {
      if (ctx.step >= maxSteps) {
        ctx.halt = true;
        ctx.haltReason = `step budget exhausted (${maxSteps})`;
      }
    },
  };
}

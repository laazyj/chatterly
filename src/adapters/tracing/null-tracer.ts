import { type Tracer } from "../../core/ports/index.ts";

/** Discards spans. Used by tests and by evals that only care about the answer. */
export const nullTracer: Tracer = {
  start() {
    return () => {
      // Intentionally nothing.
    };
  },
};

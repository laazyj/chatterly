import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { type Tracer } from "../../core/ports/index.ts";
import { type Span } from "../../core/types/index.ts";

export interface JsonlTracerOptions {
  dir: string;
  sessionId: string;
  turnId: string;
}

/**
 * Appends one JSON object per span to `<dir>/traces/<sessionId>.jsonl`.
 *
 * Writes are synchronous on purpose: a trace that loses its tail when the process exits
 * is worse than useless when you are debugging why a turn went wrong.
 */
export function createJsonlTracer(options: JsonlTracerOptions): Tracer {
  const { dir, sessionId, turnId } = options;
  const file = join(dir, "traces", `${sessionId}.jsonl`);
  mkdirSync(dirname(file), { recursive: true });

  return {
    location: file,
    start(seed) {
      const startedAt = Date.now();
      let ended = false;

      return (outcome) => {
        if (ended) return;
        ended = true;
        const span: Span = {
          ...seed,
          sessionId,
          turnId,
          startedAt,
          durationMs: Date.now() - startedAt,
          ok: outcome?.ok ?? true,
          attributes: outcome?.attributes ?? {},
        };
        appendFileSync(file, `${JSON.stringify(span)}\n`, "utf8");
      };
    },
  };
}

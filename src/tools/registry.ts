import { type ToolExecutor } from "../core/ports/index.ts";
import {
  type ToolCall,
  type ToolContext,
  type ToolResult,
  type ToolSpec,
} from "../core/types/index.ts";
import { rejectOnAbort } from "../util/reject-on-abort.ts";
import { ToolArgsError, UnknownToolError } from "./errors/index.ts";
import { formatIssues } from "./format-issues.ts";
import { toToolSpec } from "./to-tool-spec.ts";
import { type ToolDefinition } from "./types/index.ts";

export interface ToolRegistryOptions {
  /** Per-call deadline. A tool that ignores its signal is still cut off by the race. */
  timeoutMs: number;
}

/**
 * Holds the tools and runs them: the adapter behind the `ToolExecutor` port.
 *
 * It lives with the tool subsystem rather than under `src/adapters/` because tools are a
 * first-class extension surface for this project, not infrastructure to be swapped out.
 *
 * `execute` never throws: unknown tools, bad arguments, timeouts and handler exceptions
 * all become ToolResults with `isError: true`. That is deliberate — the model is often
 * able to recover from being told what went wrong, and an exception here would instead
 * kill a turn that was still salvageable.
 */
export class ToolRegistry implements ToolExecutor {
  readonly #tools = new Map<string, ToolDefinition>();
  readonly #timeoutMs: number;

  constructor(options: ToolRegistryOptions) {
    this.#timeoutMs = options.timeoutMs;
  }

  register(tool: ToolDefinition): this {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.#tools.set(tool.name, tool);
    return this;
  }

  get(name: string): ToolDefinition | undefined {
    return this.#tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.#tools.values()];
  }

  get size(): number {
    return this.#tools.size;
  }

  specs(): ToolSpec[] {
    return this.list().map(toToolSpec);
  }

  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    const startedAt = Date.now();
    const done = (content: string, isError: boolean): ToolResult => ({
      callId: call.id,
      name: call.name,
      content,
      isError,
      durationMs: Date.now() - startedAt,
    });

    const tool = this.#tools.get(call.name);
    if (!tool) {
      const known = this.list()
        .map((registered) => registered.name)
        .join(", ");
      const error = new UnknownToolError(call.name);
      return done(`${error.message}. Available tools: ${known || "none"}`, true);
    }

    const parsed = tool.parameters.safeParse(call.args);
    if (!parsed.success) {
      return done(new ToolArgsError(call.name, formatIssues(parsed.error)).message, true);
    }

    const cleanup = new AbortController();
    const signal = AbortSignal.any([context.signal, AbortSignal.timeout(this.#timeoutMs)]);
    try {
      const content = await Promise.race([
        Promise.resolve(
          tool.execute(parsed.data, {
            signal,
            sessionId: context.sessionId,
            turnId: context.turnId,
          }),
        ),
        rejectOnAbort(signal, cleanup.signal),
      ]);
      return done(content, false);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return done(`Tool "${call.name}" failed: ${reason}`, true);
    } finally {
      cleanup.abort();
    }
  }
}

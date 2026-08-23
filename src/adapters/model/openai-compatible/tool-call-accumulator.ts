import { type ToolCall } from "../../../core/types/index.ts";
import { type WireToolCallDelta } from "./wire.ts";

/**
 * Reassembles tool calls that arrive in fragments.
 *
 * The server streams `arguments` as a growing string, so nothing can be parsed until the
 * generation finishes — `drain` is where the JSON is finally read. Malformed arguments
 * become `{}` rather than an exception: the registry's schema validation will reject them
 * with a message the model can act on, which is a better failure than a dead turn.
 */
export class ToolCallAccumulator {
  readonly #calls = new Map<number, { id: string; name: string; args: string }>();

  add(delta: WireToolCallDelta): void {
    const index = delta.index ?? 0;
    const existing = this.#calls.get(index) ?? { id: "", name: "", args: "" };

    this.#calls.set(index, {
      id: delta.id ?? existing.id,
      name: delta.function?.name ?? existing.name,
      args: existing.args + (delta.function?.arguments ?? ""),
    });
  }

  get size(): number {
    return this.#calls.size;
  }

  drain(): ToolCall[] {
    const calls = [...this.#calls.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, call]) => call.name !== "")
      .map(([index, call]) => ({
        id: call.id === "" ? `call-${String(index + 1)}` : call.id,
        name: call.name,
        args: parseArgs(call.args),
      }));

    this.#calls.clear();
    return calls;
  }
}

function parseArgs(raw: string): unknown {
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

import { type ExtractResult, type ToolCall } from "../../../core/types/index.ts";
import { repairJson } from "./repair-json.ts";

const FENCED_BLOCK = /```(?:json)?\s*([\s\S]*?)```/g;

/**
 * Reads tool calls out of a model's plain text.
 *
 * A fenced block is only treated as a tool call when it parses to an object carrying a
 * tool name — a model returning JSON *as its answer* must not be mistaken for one making
 * a call. `tool`/`name` and `args`/`arguments` are both accepted because small models mix
 * them constantly and rejecting the variant costs a turn for no benefit.
 *
 * Reports failure as a value only when a block clearly intends to be a call but cannot be
 * read even after repair.
 */
export function parseToolCalls(content: string): ExtractResult {
  const blocks = [...content.matchAll(FENCED_BLOCK)].map((match) => ({
    raw: match[0],
    body: match[1] ?? "",
  }));

  if (blocks.length === 0) {
    const trimmed = content.trim();
    if (!trimmed.startsWith("{")) return { ok: true, text: trimmed, calls: [] };

    const bare = readCall(trimmed, 0);
    if (!bare.ok) return bare;
    return bare.call
      ? { ok: true, text: "", calls: [bare.call] }
      : { ok: true, text: trimmed, calls: [] };
  }

  const calls: ToolCall[] = [];
  let text = content;

  for (const [index, block] of blocks.entries()) {
    const read = readCall(block.body, index);
    if (!read.ok) return read;
    if (!read.call) continue;
    calls.push(read.call);
    text = text.replace(block.raw, "");
  }

  return { ok: true, text: text.trim(), calls };
}

/** A call, nothing (the block was not a call), or a failure to report upward. */
type ReadCall = { ok: true; call?: ToolCall } | { ok: false; reason: string; raw: string };

function readCall(body: string, index: number): ReadCall {
  const value = tryParse(body) ?? tryParse(repairJson(body));

  if (value === undefined) {
    if (body.includes('"tool"') || body.includes('"name"')) {
      return { ok: false, reason: "tool call block is not valid JSON", raw: body };
    }
    return { ok: true };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: true };

  const record = value as Record<string, unknown>;
  const name = record.tool ?? record.name;
  if (typeof name !== "string" || name === "") return { ok: true };

  return {
    ok: true,
    call: { id: `call-${String(index + 1)}`, name, args: record.args ?? record.arguments ?? {} },
  };
}

function tryParse(text: string | undefined): unknown {
  if (text === undefined || text.trim() === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

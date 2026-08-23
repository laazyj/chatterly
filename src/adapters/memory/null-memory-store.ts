import { type MemoryRecord, type MemoryStore } from "../../core/ports/index.ts";

/**
 * Long-term memory that remembers nothing.
 *
 * The seam, wired and called every turn, with no implementation behind it. A memory spike
 * replaces this object and changes nothing else: ContextAssembler already asks for
 * recollections and already puts them in the prompt.
 *
 * `remember` returns a well-formed record it immediately discards, so callers written
 * against a real store still typecheck and run here.
 */
export function nullMemoryStore(): MemoryStore {
  return {
    name: "null",

    recall() {
      return Promise.resolve([]);
    },

    remember(text, tags) {
      const record: MemoryRecord = {
        id: `discarded-${String(Date.now())}`,
        text,
        createdAt: Date.now(),
        ...(tags === undefined ? {} : { tags }),
      };
      return Promise.resolve(record);
    },
  };
}

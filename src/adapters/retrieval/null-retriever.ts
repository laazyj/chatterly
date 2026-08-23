import { type Retriever } from "../../core/ports/index.ts";

/**
 * Retrieval that finds nothing.
 *
 * The RAG seam, wired and called every turn. Swapping this for something that returns one
 * hard-coded document is the fastest way to prove the plumbing works before building an
 * index — see the extension smoke test in the README.
 */
export function nullRetriever(): Retriever {
  return {
    name: "null",
    retrieve() {
      return Promise.resolve([]);
    },
  };
}

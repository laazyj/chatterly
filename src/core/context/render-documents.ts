import { type RetrievedDocument } from "../ports/index.ts";

/**
 * Renders retrieved documents as a system-prompt section.
 *
 * Sources are labelled and the model is told to say when the material does not answer the
 * question — the failure mode of retrieval on a small model is confident use of an
 * irrelevant chunk, and this is the cheapest defence against it.
 */
export function renderDocuments(documents: RetrievedDocument[]): string {
  if (documents.length === 0) return "";

  const blocks = documents
    .map((document, index) => `[${String(index + 1)}] ${document.source}\n${document.text}`)
    .join("\n\n");

  return [
    "## Reference material",
    "Use only what is relevant. If it does not answer the question, say so.",
    "",
    blocks,
  ].join("\n");
}

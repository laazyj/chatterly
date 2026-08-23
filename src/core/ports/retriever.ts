/** A chunk of source material with enough provenance to cite it. */
export interface RetrievedDocument {
  id: string;
  text: string;
  source: string;
  /** Higher is more relevant. Scale is retriever-defined; only ordering is meaningful. */
  score: number;
}

/**
 * Document retrieval. SEAM — the scaffold ships a null implementation returning nothing.
 *
 * Deliberately not an embeddings interface: whether relevance comes from vectors, BM25,
 * or a SQL LIKE is the retriever's business, and pinning that choice here would be the
 * one decision hardest to walk back.
 */
export interface Retriever {
  readonly name: string;
  retrieve(query: string, limit: number): Promise<RetrievedDocument[]>;
}

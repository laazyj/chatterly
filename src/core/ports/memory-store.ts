/** A durable fact about the user or the world, surviving across sessions. */
export interface MemoryRecord {
  id: string;
  text: string;
  createdAt: number;
  /** Free-form tags a retrieval strategy may filter on. */
  tags?: string[];
}

/**
 * Long-term memory. SEAM — the scaffold ships a null implementation that stores nothing.
 *
 * ContextAssembler always calls `recall`, so implementing this interface is the whole of
 * a memory spike: nothing in the agent loop changes.
 */
export interface MemoryStore {
  readonly name: string;
  /** Called by ContextAssembler each turn. The query is the user's current message. */
  recall(query: string, limit: number): Promise<MemoryRecord[]>;
  remember(text: string, tags?: string[]): Promise<MemoryRecord>;
}

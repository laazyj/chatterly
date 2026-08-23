import { type MemoryRecord } from "../ports/index.ts";

/** Renders recalled memories as a system-prompt section. Empty input yields no section. */
export function renderRecollections(records: MemoryRecord[]): string {
  if (records.length === 0) return "";
  const lines = records.map((record) => `- ${record.text}`).join("\n");
  return ["## What you remember about this user", lines].join("\n");
}

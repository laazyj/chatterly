import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Message } from "../../core/types/index.ts";
import { type SessionStore } from "../../core/ports/index.ts";

/**
 * One append-only JSONL file per session under `<dir>/sessions/`.
 *
 * Chosen over SQLite because the file *is* the debugging tool: you can read a session,
 * grep it, diff two runs, and feed it straight into an eval case without a query layer.
 * A corrupt line is skipped rather than fatal — losing one message beats losing the
 * conversation.
 */
export function jsonlSessionStore(dir: string): SessionStore {
  const root = join(dir, "sessions");
  const fileFor = (sessionId: string): string => join(root, `${sessionId}.jsonl`);

  return {
    async append(sessionId, messages) {
      if (messages.length === 0) return;
      await mkdir(root, { recursive: true });
      const lines = messages.map((message) => `${JSON.stringify(message)}\n`).join("");
      await appendFile(fileFor(sessionId), lines, "utf8");
    },

    async load(sessionId) {
      let raw: string;
      try {
        raw = await readFile(fileFor(sessionId), "utf8");
      } catch {
        return [];
      }

      const messages: Message[] = [];
      for (const line of raw.split("\n")) {
        if (line.trim() === "") continue;
        try {
          messages.push(JSON.parse(line) as Message);
        } catch {
          // Truncated final write, most likely. Keep what parsed.
        }
      }
      return messages;
    },

    async list() {
      try {
        const files = await readdir(root);
        return files
          .filter((file) => file.endsWith(".jsonl"))
          .map((file) => file.replace(/\.jsonl$/, ""))
          .sort();
      } catch {
        return [];
      }
    },
  };
}

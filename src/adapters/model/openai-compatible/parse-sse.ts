/**
 * Turns an SSE response body into parsed JSON payloads.
 *
 * Uses an explicit reader rather than async iteration over the stream so cancellation is
 * unambiguous, and skips unparseable frames instead of throwing — local servers emit
 * keepalives and the occasional non-JSON comment line, and dying on one would drop an
 * otherwise good generation.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        for (const line of frame.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const data = trimmed.slice("data:".length).trim();
          if (data === "[DONE]") return;

          try {
            yield JSON.parse(data);
          } catch {
            // Keepalive or partial frame: ignore.
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

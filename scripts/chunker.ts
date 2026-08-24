/**
 * Text chunking with paragraph awareness and overlap.
 * Never splits mid-paragraph unless a single paragraph exceeds the target size.
 */

export interface Chunk {
  text: string;
  ordinal: number;
}

export interface ChunkerOptions {
  /** Target size in characters. Chunks may be larger if a single paragraph exceeds this. */
  targetSize?: number;
  /** Overlap in characters between consecutive chunks. */
  overlap?: number;
}

/**
 * Split text into paragraphs. A paragraph is separated by one or more blank lines.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Chunk text with paragraph awareness.
 * 
 * Strategy:
 * - Split text into paragraphs first
 * - Pack paragraphs into chunks up to targetSize
 * - Never split a paragraph unless it alone exceeds targetSize
 * - Add overlap by including the last ~overlap chars from the previous chunk
 */
export function chunkText(text: string, options: ChunkerOptions = {}): Chunk[] {
  const targetSize = options.targetSize ?? 800;
  const overlap = options.overlap ?? 100;
  const paragraphs = splitParagraphs(text);

  if (paragraphs.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentChunk = "";
  let previousTail = "";

  for (const paragraph of paragraphs) {
    // If this single paragraph exceeds target, make it its own chunk
    if (paragraph.length > targetSize) {
      // Flush current chunk if it has content
      if (currentChunk.length > 0) {
        chunks.push({ text: currentChunk, ordinal: chunks.length });
        previousTail = currentChunk.slice(-overlap);
        currentChunk = "";
      }

      // Add the large paragraph as its own chunk with overlap from previous
      const chunkText = previousTail ? previousTail + "\n\n" + paragraph : paragraph;
      chunks.push({ text: chunkText, ordinal: chunks.length });
      previousTail = paragraph.slice(-overlap);
      continue;
    }

    // Try to add this paragraph to the current chunk
    // If we have a current chunk, append to it; otherwise start fresh with overlap
    const testChunk = currentChunk
      ? currentChunk + "\n\n" + paragraph
      : previousTail
        ? previousTail + "\n\n" + paragraph
        : paragraph;

    // Check if adding this paragraph fits, or if this is the first paragraph in a new chunk
    if (testChunk.length <= targetSize || currentChunk.length === 0) {
      // Fits: update currentChunk
      currentChunk = currentChunk
        ? currentChunk + "\n\n" + paragraph
        : previousTail
          ? previousTail + "\n\n" + paragraph
          : paragraph;
    } else {
      // Doesn't fit: flush current chunk and start new one with overlap + this paragraph
      chunks.push({ text: currentChunk, ordinal: chunks.length });
      previousTail = currentChunk.slice(-overlap);
      currentChunk = previousTail ? previousTail + "\n\n" + paragraph : paragraph;
    }
  }

  // Flush any remaining content
  if (currentChunk.length > 0) {
    chunks.push({ text: currentChunk, ordinal: chunks.length });
  }

  return chunks;
}

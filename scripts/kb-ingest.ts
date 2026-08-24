#!/usr/bin/env node
/**
 * Standalone knowledge base ingestion script.
 * Fetches wine/viticulture content from Wikipedia, chunks it, embeds it, and stores in sqlite-vec.
 */

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";
import { chunkText } from "./chunker.ts";
import { fetchWikipediaArticles } from "./fetch-wikipedia.ts";

// Configuration
const COLLECTION = "wine";
const DB_PATH = ".data/knowledge.db";
const EMBED_MODEL = "nomic-embed-text";
const EMBED_DIMENSIONS = 768;
const BASE_URL = "http://localhost:11434/v1";
const API_KEY = "not-needed";
const CHUNK_TARGET_SIZE = 800;
const CHUNK_OVERLAP = 100;
const EMBED_CONCURRENCY = 4;

// Wine-related Wikipedia articles to fetch
const WINE_ARTICLES = [
  "Wine",
  "Viticulture",
  "Winemaking",
  "Wine tasting",
  "Wine and food pairing",
  "Wine chemistry",
  "Terroir",
  "Oak (wine)",
  "Fermentation in winemaking",
  "Champagne",
  "Bordeaux wine",
  "Burgundy wine",
  "Napa Valley AVA",
  "Grape varieties",
  "Cabernet Sauvignon",
  "Chardonnay",
  "Pinot noir",
  "Merlot",
  "Sauvignon blanc",
  "Riesling",
];

interface ChunkRecord {
  hash: string;
  docId: string;
  source: string;
  title: string;
  ordinal: number;
  text: string;
}

/**
 * Convert a number array to a Uint8Array for sqlite-vec.
 */
function toBlob(vector: number[]): Uint8Array {
  const float32 = new Float32Array(vector);
  return new Uint8Array(float32.buffer);
}

/**
 * Compute SHA-256 hash of text for deduplication.
 */
function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Embed text using OpenAI-compatible embeddings API.
 */
async function embed(text: string): Promise<number[]> {
  const endpoint = `${BASE_URL}/embeddings`;
  const timeout = AbortSignal.timeout(10_000);
  
  const response = await fetch(endpoint, {
    method: "POST",
    signal: timeout,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    data?: { embedding?: number[] }[];
  };

  const vector = data.data?.[0]?.embedding;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("No embedding returned");
  }

  if (vector.length !== EMBED_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBED_DIMENSIONS} dimensions, got ${vector.length}`,
    );
  }

  return vector;
}

/**
 * Embed chunks with concurrency limit.
 */
async function embedChunks(
  chunks: ChunkRecord[],
): Promise<Map<string, number[]>> {
  const embeddings = new Map<string, number[]>();
  const queue = [...chunks];
  let completed = 0;
  let errors = 0;

  async function worker() {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      try {
        const vector = await embed(chunk.text);
        embeddings.set(chunk.hash, vector);
        completed++;
        if (completed % 10 === 0) {
          console.log(`  Embedded ${completed}/${chunks.length} chunks`);
        }
      } catch (error) {
        errors++;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  Failed to embed chunk: ${message}`);
      }
    }
  }

  // Run workers in parallel with concurrency limit
  await Promise.all(
    Array.from({ length: EMBED_CONCURRENCY }, () => worker()),
  );

  console.log(
    `  Completed: ${completed}/${chunks.length} chunks (${errors} errors)`,
  );
  return embeddings;
}

/**
 * Open or create the knowledge base database with sqlite-vec.
 */
function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path, { allowExtension: true });
  
  try {
    db.enableLoadExtension(true);
    sqliteVec.load(db);
    db.enableLoadExtension(false);

    // Create the kb_chunks table if it doesn't exist
    // chunk_id uses implicit sqlite autoincrement for primary key
    db.exec(`
      create virtual table if not exists kb_chunks using vec0(
        collection text partition key,
        chunk_id integer primary key,
        embedding float[${EMBED_DIMENSIONS}] distance_metric=cosine,
        +doc_id text,
        +source text,
        +title text,
        +ordinal integer,
        +text text,
        +hash text,
        +ingested_at integer
      )
    `);
  } catch (error) {
    db.close();
    throw error;
  }

  return db;
}

/**
 * Check if a chunk already exists by hash.
 */
function chunkExists(db: DatabaseSync, collection: string, hash: string): boolean {
  const stmt = db.prepare(
    "select 1 from kb_chunks where collection = ? and hash = ? limit 1",
  );
  return stmt.get(collection, hash) !== undefined;
}

/**
 * Insert a chunk into the database.
 */
function insertChunk(
  db: DatabaseSync,
  collection: string,
  chunk: ChunkRecord,
  embedding: number[],
): void {
  const stmt = db.prepare(`
    insert into kb_chunks (collection, embedding, doc_id, source, title, ordinal, text, hash, ingested_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    collection,
    toBlob(embedding),
    chunk.docId,
    chunk.source,
    chunk.title,
    BigInt(chunk.ordinal),
    chunk.text,
    chunk.hash,
    BigInt(Date.now()),
  );
}

/**
 * Main ingestion flow.
 */
async function main() {
  console.log("=== Knowledge Base Ingestion ===\n");
  console.log(`Collection: ${COLLECTION}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Embed model: ${EMBED_MODEL} (${EMBED_DIMENSIONS}D)`);
  console.log(`Chunk size: ~${CHUNK_TARGET_SIZE} chars, ${CHUNK_OVERLAP} char overlap\n`);

  // Step 1: Fetch Wikipedia articles
  console.log("Fetching Wikipedia articles...");
  const documents = await fetchWikipediaArticles(WINE_ARTICLES);
  console.log(`Fetched ${documents.length}/${WINE_ARTICLES.length} articles\n`);

  if (documents.length === 0) {
    console.error("No documents fetched. Exiting.");
    process.exit(1);
  }

  // Step 2: Chunk documents
  console.log("Chunking documents...");
  const allChunks: ChunkRecord[] = [];

  for (const doc of documents) {
    const chunks = chunkText(doc.text, {
      targetSize: CHUNK_TARGET_SIZE,
      overlap: CHUNK_OVERLAP,
    });

    for (const chunk of chunks) {
      allChunks.push({
        hash: hashText(chunk.text),
        docId: doc.url,
        source: doc.url,
        title: doc.title,
        ordinal: chunk.ordinal,
        text: chunk.text,
      });
    }
  }

  console.log(`Created ${allChunks.length} chunks\n`);

  // Step 3: Open database and check for existing chunks
  console.log("Opening database...");
  const db = openDb(DB_PATH);
  console.log(`Database opened: ${DB_PATH}\n`);

  let newChunks: ChunkRecord[];
  let skipped: number;
  let inserted = 0;
  let failed = 0;

  try {
    console.log("Checking for existing chunks...");
    newChunks = allChunks.filter(
      (chunk) => !chunkExists(db, COLLECTION, chunk.hash),
    );
    skipped = allChunks.length - newChunks.length;
    console.log(`New chunks: ${newChunks.length}, Skipped (already exist): ${skipped}\n`);

    if (newChunks.length === 0) {
      console.log("All chunks already exist. Nothing to do.");
      return;
    }

    // Step 4: Embed new chunks
    console.log(`Embedding ${newChunks.length} chunks...`);
    const embeddings = await embedChunks(newChunks);
    console.log();

    // Step 5: Insert chunks into database
    console.log("Inserting chunks into database...");

    for (const chunk of newChunks) {
      const embedding = embeddings.get(chunk.hash);
      if (embedding) {
        insertChunk(db, COLLECTION, chunk, embedding);
        inserted++;
      } else {
        failed++;
      }
    }

    console.log(`Inserted ${inserted} chunks\n`);
    if (failed > 0) {
      console.warn(`Warning: ${failed} chunks failed to embed and were not inserted\n`);
    }
  } finally {
    db.close();
  }

  // Summary
  console.log("=== Summary ===");
  console.log(`Documents: ${documents.length}`);
  console.log(`Total chunks: ${allChunks.length}`);
  console.log(`New chunks: ${newChunks.length}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Inserted: ${inserted}`);
  if (failed > 0) {
    console.log(`Failed to embed: ${failed}`);
  }
  console.log("\nDone!");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

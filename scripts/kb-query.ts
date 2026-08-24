#!/usr/bin/env node
/**
 * Query the knowledge base with semantic search.
 */

import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";

const DB_PATH = ".data/knowledge.db";
const EMBED_MODEL = "nomic-embed-text";
const BASE_URL = "http://localhost:11434/v1";
const API_KEY = "not-needed";

/**
 * Convert a number array to a Uint8Array for sqlite-vec.
 */
function toBlob(vector: number[]): Uint8Array {
  const float32 = new Float32Array(vector);
  return new Uint8Array(float32.buffer);
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

  return vector;
}

function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { allowExtension: true });
  db.enableLoadExtension(true);
  sqliteVec.load(db);
  db.enableLoadExtension(false);
  return db;
}

async function search(collection: string, query: string, k = 5) {
  console.log(`\n=== Searching: "${query}" ===\n`);

  // Embed the query
  console.log("Embedding query...");
  const vector = await embed(query);
  console.log(`Embedded (${vector.length}D)\n`);

  // Open database
  const db = openDb(DB_PATH);

  try {
    // Search
    const stmt = db.prepare(`
      SELECT title, source, text, distance
      FROM kb_chunks
      WHERE collection = ? AND embedding MATCH ? AND k = ?
      ORDER BY distance
    `);

    const results = stmt.all(collection, toBlob(vector), k);

    console.log(`Found ${results.length} results:\n`);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;
      console.log(`[${i + 1}] Distance: ${Number(result.distance).toFixed(4)}`);
      console.log(`    Title: ${String(result.title)}`);
      console.log(`    Source: ${String(result.source)}`);
      console.log(`    Text: ${String(result.text).slice(0, 150)}...`);
      console.log();
    }
  } finally {
    db.close();
  }
}

// Get query from command line or use default
const query = process.argv[2] ?? "How is champagne made?";
const kArg = parseInt(process.argv[3] ?? "5", 10);
const k = Number.isNaN(kArg) || kArg < 1 ? 5 : kArg;
const collection = process.argv[4] ?? "wine";

search(collection, query, k).catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});

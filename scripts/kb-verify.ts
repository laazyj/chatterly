#!/usr/bin/env node
/**
 * Verify the knowledge base contents.
 */

import { DatabaseSync } from "node:sqlite";
import * as sqliteVec from "sqlite-vec";

const DB_PATH = ".data/knowledge.db";
const COLLECTION = "wine";

function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { allowExtension: true });
  db.enableLoadExtension(true);
  sqliteVec.load(db);
  db.enableLoadExtension(false);
  return db;
}

function main() {
  const db = openDb(DB_PATH);

  try {
    // Get collection stats
    const collectionStats = db.prepare(`
      SELECT collection, COUNT(*) as chunks, COUNT(DISTINCT title) as docs
      FROM kb_chunks
      GROUP BY collection
    `).all();

    console.log("=== Knowledge Base Stats ===\n");
    for (const row of collectionStats) {
      console.log(`Collection: ${String(row.collection)}`);
      console.log(`  Documents: ${String(row.docs)}`);
      console.log(`  Chunks: ${String(row.chunks)}\n`);
    }

    // Get document list
    const documents = db.prepare(`
      SELECT DISTINCT title, source, COUNT(*) as chunk_count
      FROM kb_chunks
      WHERE collection = ?
      GROUP BY title, source
      ORDER BY title
    `).all(COLLECTION);

    console.log("=== Documents ===\n");
    for (const doc of documents) {
      console.log(String(doc.title));
      console.log(`  Chunks: ${String(doc.chunk_count)}`);
      console.log(`  Source: ${String(doc.source)}\n`);
    }

    // Show a sample chunk
    const sample = db.prepare(`
      SELECT title, text
      FROM kb_chunks
      WHERE collection = ?
      LIMIT 1
    `).get(COLLECTION);

    if (sample) {
      console.log("=== Sample Chunk ===\n");
      console.log(`Title: ${String(sample.title)}`);
      console.log(`Text: ${String(sample.text).slice(0, 200)}...\n`);
    }
  } finally {
    db.close();
  }
}

main();

# Knowledge Base Scripts

Standalone scripts for populating and querying a wine/viticulture knowledge base using sqlite-vec.

## Files

- `fetch-wikipedia.ts` - Fetches Wikipedia articles via the API
- `chunker.ts` - Paragraph-aware text chunking with overlap
- `kb-ingest.ts` - Main ingestion script: fetch → chunk → embed → store
- `kb-verify.ts` - Verify database contents and show stats
- `kb-query.ts` - Query the knowledge base with semantic search

## Database

- **Location**: `.data/knowledge.db`
- **Table**: `kb_chunks` (vec0 virtual table)
- **Collection**: `wine` (partition key)
- **Embedding model**: `nomic-embed-text` (768D)
- **Distance metric**: cosine

## Usage

### Ingest Content

```bash
node scripts/kb-ingest.ts
```

Fetches 20 wine-related Wikipedia articles (or as many as Wikipedia allows), chunks them into ~800 char pieces with 100 char overlap, embeds with nomic-embed-text, and stores in the database. Idempotent - re-running skips already-ingested chunks by hash.

### Verify Database

```bash
node scripts/kb-verify.ts
```

Shows collection stats, document list with chunk counts, and a sample chunk.

### Query Knowledge Base

```bash
node scripts/kb-query.ts "How is champagne made?" [k] [collection]
```

Embeds the query and returns the top k results (default 5) from the specified collection (default "wine"). Shows distance, title, source, and text snippet for each result.

## Current Data

- **Documents**: 10 Wikipedia articles
- **Chunks**: 223
- **Topics**: Wine, Viticulture, Winemaking, Wine tasting, Wine and food pairing, Wine chemistry, Terroir, Oak (wine), Fermentation in winemaking, Champagne

## Example Queries

```bash
# Champagne production
node scripts/kb-query.ts "How is champagne made?"

# Food pairing
node scripts/kb-query.ts "What foods pair well with red wine?"

# Viticulture
node scripts/kb-query.ts "What factors affect grape growing?"

# Oak barrels
node scripts/kb-query.ts "Why are oak barrels used in winemaking?" 3
```

## Requirements

- Node.js 24+ (for native TypeScript support)
- Ollama running locally with `nomic-embed-text` model
- Internet connection (for Wikipedia API)

## Notes

- Wikipedia API has rate limits (429 errors). The script handles this gracefully by continuing with successfully fetched articles.
- Chunks are deduplicated by SHA-256 hash, making re-ingestion cheap.
- Chunking respects paragraph boundaries - never splits mid-paragraph unless a single paragraph exceeds the target size.
- Embedding concurrency is limited to 4 to avoid overwhelming the local model server.

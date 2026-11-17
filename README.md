# AI Knowledge Inbox

Save notes and URLs, then ask questions answered by a RAG pipeline with cited sources.

## Quick start
1. `cd server && cp .env.example .env` → add `GEMINI_API_KEY`
2. `npm install && npm run dev`   (API on :4000)
3. `cd ../client && npm install && npm run dev`   (UI on :5173)
4. Tests: `cd server && npm test`

## Architecture
```
POST /ingest ─ routes (zod) ─ ingest.service ─ fetchUrl? → chunker → embedder → db (tx)
POST /query  ─ routes (zod) ─ query.service  ─ embedder → retriever → prompt → llm → citation map
GET  /items  ─ routes ─ items.repository
```
- `routes/` thin: validate, call service, respond.
- `services/` orchestrate; never touch `req`/`res`.
- `rag/` chunking, embeddings, cosine retrieval, prompt.
- `db/` the only place with SQL. `lib/llm.ts` the only place that calls Gemini.

## Design decisions
- **Chunking:** paragraph-aware packing to ~2000 chars (~500 tokens) with ~300 chars (15%) overlap.
  Paragraphs keep one idea together (better embeddings than fixed cuts); overlap stops answers
  being lost at a boundary; ~500 tokens is specific enough to retrieve precisely yet keeps context;
  short notes stay a single chunk. Oversized paragraphs split on sentence boundaries.
- **Vector store:** SQLite + in-memory cosine. Zero setup, exact results, fine for small data.
- **Citations:** passages are numbered in the prompt; `[n]` markers are parsed from the answer and
  only those passages are returned. If the model cites nothing, all retrieved passages come back
  with `cited: false`.
- **No-match guard:** if nothing scores ≥ 0.25, the LLM is skipped and the fallback answer returned.
- **Sync ingestion:** fine for one user; `items.status` is ready for async processing later.

## Tradeoffs & what breaks at scale
- Brute-force search is O(n) per query → slow beyond ~50k chunks.
- All embeddings are loaded into memory on every query.
- SQLite allows one writer at a time.
- Ingest blocks the request during fetch and embedding.
- No dedup, rate limiting, or retries.
- Fixed chunk size is not tuned per content type.
- **No SSRF protection:** URL fetch can reach private IP ranges. Must be blocked in production.

## Production changes
- pgvector / Qdrant with HNSW index
- Job queue (BullMQ) for ingestion + status polling/SSE
- Retries with backoff, rate limiting, content-hash dedup
- Hybrid search (BM25 + vectors) + reranker
- SSRF protection on URL fetch
- Auth + per-user data isolation
- Retrieval eval set + tracing (latency, token cost)

## What I'd do with more time
Streaming answers, delete/edit items, PDF upload, better HTML cleanup.
# index

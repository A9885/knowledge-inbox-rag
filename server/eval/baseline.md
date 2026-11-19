# Eval baseline (2026-11-18)

Run: `cd server && npm run eval` against the live API (8 seeded items, NVIDIA `poolside/laguna-xs-2.1` answers, Gemini embeddings).
Questions: `eval/questions.json` (13: 6 single, 2 follow-up chats of 2, 3 not-in-notes).

| Metric | Value |
|--------|-------|
| Eval score | **13 / 13** |
| Avg time to first word | 12.5 s (range 4.3 - 25.0 s) |
| Avg total answer time | 24.8 s |
| Time to save a URL (Wikipedia "Goa", scratch copy of the DB) | 6.8 s |

Note: first-word time is far above the 0.3-0.5 s measured in the earlier model benchmark. The `DEBUG=true` timings
show embedding at about 0.8 s and search at 7 ms, so the delay is the answer-model provider on the day of the run.
Re-run when the provider is quiet before comparing speed across changes; compare the score first.

# Eval hybrid-rrf (2026-11-18)
Dataset `people` (37 questions), retrieval `hybrid/rrf` topK 5, answers off.

Recall/MRR/Hit@1 use the raw ranked list (before the relevance filter). Keyword acc = all expected keywords in the answer. Citation acc = share of expected items cited. Not-found ok = said "couldn't find" with no sources.

| Category | n | Recall@3 | Recall@5 | MRR | Hit@1 | Keyword acc | Citation acc | Not-found ok |
|---|---|---|---|---|---|---|---|---|
| **Overall** | 37 | 99% | 100% | 0.95 | 90% | - | - | - |
| single_fact | 10 | 100% | 100% | 1.00 | 100% | - | - | - |
| two_entities | 4 | 100% | 100% | 0.88 | 75% | - | - | - |
| list_filter | 4 | 90% | 100% | 0.88 | 75% | - | - | - |
| keywords_only | 4 | 100% | 100% | 1.00 | 100% | - | - | - |
| changed_fact | 3 | 100% | 100% | 0.83 | 67% | - | - | - |
| similar_names | 4 | 100% | 100% | 1.00 | 100% | - | - | - |
| not_found | 4 | - | - | - | - | - | - | - |
| follow_up | 4 | - | - | - | - | - | - | - |

## Speed (ms)

| Step | p50 | p95 |
|---|---|---|
| embed | 0 | 603 |
| search | 1 | 3 |
| first token | - | - |
| total answer | - | - |

## Problem questions (0)


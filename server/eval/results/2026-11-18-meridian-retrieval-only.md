# Eval meridian (2026-11-18)
Dataset `meridian` (39 questions), retrieval `hybrid/weighted` topK 5, answers off.

Recall/MRR/Hit@1 use the raw ranked list (before the relevance filter). Keyword acc = all expected keywords in the answer and none of the forbidden ones. Citation acc = share of expected items cited. Not-found ok = said "couldn't find" with no sources.

| Category | n | Recall@3 | Recall@5 | MRR | Hit@1 | Keyword acc | Citation acc | Not-found ok |
|---|---|---|---|---|---|---|---|---|
| **Overall** | 39 | 94% | 95% | 0.85 | 74% | - | - | - |
| single_fact | 6 | 100% | 100% | 0.83 | 67% | - | - | - |
| who_said | 4 | 100% | 100% | 0.88 | 75% | - | - | - |
| changed_fact | 4 | 100% | 100% | 0.75 | 50% | - | - | - |
| date_scoped | 4 | 100% | 100% | 1.00 | 100% | - | - | - |
| trap | 5 | 90% | 90% | 1.00 | 100% | - | - | - |
| list | 4 | 67% | 75% | 0.65 | 50% | - | - | - |
| not_found | 4 | - | - | - | - | - | - | - |
| follow_up | 4 | - | - | - | - | - | - | - |
| injection | 4 | 100% | 100% | 0.83 | 75% | - | - | - |

## Speed (ms)

| Step | p50 | p95 |
|---|---|---|
| embed | 0 | 0 |
| search | 1 | 3 |
| first token | - | - |
| total answer | - | - |

## Problem questions (2)

- **trp03** (trap) How many customers do we have?
  - expected: SAL005, MSG003; keywords: 86, 14
  - retrieved top 5: SAL005 · Pipeline snapshot — | OLD001 · Earlier account cou | MSG010 · #customer-success u | PRD005 · Customer feedback:  | ADD002 · Decision on feature
  - answer: -
- **lst04** (list) What is still open before Insights v1 can ship?
  - expected: PRD004; keywords: audit, Security
  - retrieved top 5: URL003 · Insights v1 release | PRD002 · Launch date working | PRD001 · Insights v1 scope — | ENG007 · Release branch — Vi | MSG005 · #security update — 
  - answer: -

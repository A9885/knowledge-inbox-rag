# Eval hybrid-weighted (2026-11-19)
Dataset `people` (37 questions), retrieval `hybrid/weighted` topK 5, answers on.

Recall/MRR/Hit@1 use the raw ranked list (before the relevance filter). Keyword acc = all expected keywords in the answer and none of the forbidden ones. Citation acc = share of expected items cited. Not-found ok = said "couldn't find" with no sources.

| Category | n | Recall@3 | Recall@5 | MRR | Hit@1 | Keyword acc | Citation acc | Not-found ok |
|---|---|---|---|---|---|---|---|---|
| **Overall** | 37 | 98% | 99% | 0.97 | 94% | 97% | 96% | 100% |
| single_fact | 10 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |
| two_entities | 4 | 100% | 100% | 1.00 | 100% | 100% | 88% | - |
| list_filter | 4 | 85% | 90% | 0.88 | 75% | 75% | 80% | - |
| keywords_only | 4 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |
| changed_fact | 3 | 100% | 100% | 0.83 | 67% | 100% | 100% | - |
| similar_names | 4 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |
| not_found | 4 | - | - | - | - | - | - | 100% |
| follow_up | 4 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |

## Speed (ms)

| Step | p50 | p95 |
|---|---|---|
| embed | 0 | 1 |
| search | 2 | 7 |
| first token | 435 | 890 |
| total answer | 1449 | 2262 |

## Problem questions (4)

- **two02** (two_entities) Which pets do Priya Nair and Divya Menon have?
  - expected: Priya Nair, Divya Menon; keywords: cat, cockatiel
  - retrieved top 5: Priya Nair lives in Kochi an | Divya Menon lives in Bengalu | Priya Nayar lives in Hyderab | Lakshmi Pillai lives in Triv | Meera Iyer lives in Chennai 
  - answer: Priya Nair has two cats and Divya Menon has a cockatiel.
- **lis03** (list_filter) Who has no pets?
  - expected: Meera Iyer, Arjun Rai, Vikram Desai, Imran Sheikh, Farhan Ali; keywords: Meera, Arjun Rai, Vikram, Imran, Farhan
  - retrieved top 5: Arjun Rai lives in Jaipur an | Vikram Desai lives in Ahmeda | Zoya Khan lives in Bhopal an | Meera Iyer lives in Chennai  | Tarun Joshi lives in Dehradu
  - answer: Arjun Rai, Vikram Desai, and Meera Iyer have no pets. Zoya Khan has two parakeets, and Tarun Joshi has a pony.
- **key01** (keywords_only) Who has employee code EMP-4471?
  - expected: Priya Nair; keywords: Priya Nair
  - retrieved top 5: Priya Nair lives in Kochi an | Farhan Ali lives in Lucknow  | Vikram Desai lives in Ahmeda | Lakshmi Pillai lives in Triv | Meera Iyer lives in Chennai 
  - answer: PROVIDER_QUOTA: The answer model's quota was reached. Try again later, or enable billing with the provider.
- **key03** (keywords_only) Whose employee code is EMP-1451?
  - expected: Imran Sheikh; keywords: Imran
  - retrieved top 5: Imran Sheikh lives in Mumbai | Lakshmi Pillai lives in Triv | Divya Menon lives in Bengalu | Tarun Joshi lives in Dehradu | Priya Nair lives in Kochi an
  - answer: PROVIDER_QUOTA: The answer model's quota was reached. Try again later, or enable billing with the provider.

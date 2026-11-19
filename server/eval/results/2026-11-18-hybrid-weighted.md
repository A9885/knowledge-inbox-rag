# Eval hybrid-weighted (2026-11-18)
Dataset `people` (37 questions), retrieval `hybrid/weighted` topK 5, answers on.

Recall/MRR/Hit@1 use the raw ranked list (before the relevance filter). Keyword acc = all expected keywords in the answer. Citation acc = share of expected items cited. Not-found ok = said "couldn't find" with no sources.

| Category | n | Recall@3 | Recall@5 | MRR | Hit@1 | Keyword acc | Citation acc | Not-found ok |
|---|---|---|---|---|---|---|---|---|
| **Overall** | 37 | 98% | 99% | 0.98 | 97% | 97% | 90% | 100% |
| single_fact | 10 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |
| two_entities | 4 | 100% | 100% | 1.00 | 100% | 100% | 63% | - |
| list_filter | 4 | 85% | 90% | 0.88 | 75% | 75% | 55% | - |
| keywords_only | 4 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |
| changed_fact | 3 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |
| similar_names | 4 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |
| not_found | 4 | - | - | - | - | - | - | 100% |
| follow_up | 4 | 100% | 100% | 1.00 | 100% | 100% | 100% | - |

## Speed (ms)

| Step | p50 | p95 |
|---|---|---|
| embed | 0 | 1 |
| search | 2 | 6 |
| first token | 469 | 1533 |
| total answer | 1584 | 2427 |

## Problem questions (6)

- **two01** (two_entities) Where do Aarav Mehta and Karan Malhotra live?
  - expected: Aarav Mehta, Karan Malhotra; keywords: Pune, Delhi
  - retrieved top 5: Karan Malhotra lives in Delh | Aarav Mehta lives in Pune an | Neha Kapoor lives in Chandig | Vikram Desai lives in Ahmeda | Arjun Rai lives in Jaipur an
  - answer: Aarav Mehta lives in Pune and Karan Malhotra lives in Delhi.
- **two02** (two_entities) Which pets do Priya Nair and Divya Menon have?
  - expected: Priya Nair, Divya Menon; keywords: cat, cockatiel
  - retrieved top 5: Priya Nair lives in Kochi an | Divya Menon lives in Bengalu | Priya Nayar lives in Hyderab | Lakshmi Pillai lives in Triv | Meera Iyer lives in Chennai 
  - answer: Priya Nair has two cats, and Divya Menon has a cockatiel.
- **two03** (two_entities) What are the birthdays of Neha Kapoor and Vikram Desai?
  - expected: Neha Kapoor, Vikram Desai; keywords: December 19, February 18
  - retrieved top 5: Vikram Desai lives in Ahmeda | UPDATE Neha Kapoor: as of 10 | Neha Kapoor lives in Chandig | Priya Nayar lives in Hyderab | Divya Menon lives in Bengalu
  - answer: Vikram Desai's birthday is February 18, and Neha Kapoor's birthday is December 19. - What is Vikram Desai's employee code? - What is Neha Kapoor's favourite food?
- **lis02** (list_filter) Who works at Quanta Works?
  - expected: Arjun Rao, Sana Qureshi; keywords: Arjun Rao, Sana
  - retrieved top 5: UPDATE Sana Qureshi: as of 1 | Sana Qureshi lives in Hydera | Arjun Rao lives in Hyderabad | Divya Menon lives in Bengalu | Priya Nayar lives in Hyderab
  - answer: Sana Qureshi and Arjun Rao both work at Quanta Works. Sana Qureshi was promoted to head of product at Quanta Works as of 10 Nov 2026 [1], and Arjun Rao works as a data scientist at Quanta Works [3].
- **lis03** (list_filter) Who has no pets?
  - expected: Meera Iyer, Arjun Rai, Vikram Desai, Imran Sheikh, Farhan Ali; keywords: Meera, Arjun Rai, Vikram, Imran, Farhan
  - retrieved top 5: Arjun Rai lives in Jaipur an | Vikram Desai lives in Ahmeda | Zoya Khan lives in Bhopal an | Meera Iyer lives in Chennai  | Tarun Joshi lives in Dehradu
  - answer: Arjun Rai, Vikram Desai, and Meera Iyer all have no pets.
- **lis04** (list_filter) Who works at Pixelhive?
  - expected: Rohan Gill, Ishita Sen; keywords: Rohan, Ishita
  - retrieved top 5: Rohan Gill lives in Pune and | UPDATE Rohan Gill: as of 10  | Ishita Sen lives in Bhubanes | Priya Nayar lives in Hyderab | Priya Nair lives in Kochi an
  - answer: Rohan Gill and Ishita Sen both work at Pixelhive. Rohan Gill is a graphic designer (originally in Pune, now in Berlin working remotely) and Ishita Sen is a game developer in Bhubaneswar.

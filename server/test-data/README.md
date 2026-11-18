# Test data

Put your own records here, then run one command to inject them and check the responses.

```bash
cd server && npm run test:data
```

It saves everything into a **throwaway database** (`test-data/.scratch/`, deleted afterwards), so your real inbox is never touched. It makes real calls to Gemini (and NVIDIA if its key is set), so it uses embedding quota: one request per batch of chunks, plus one per question.

## Files

| File | What to put in it |
| --- | --- |
| `records.json` | `notes`: list of note texts. `urls`: list of public http(s) links. |
| `questions.json` | One entry per question to ask. |

A question entry:

```json
{ "question": "When is my dentist appointment?", "expectKeywords": ["Tuesday", "4:30"] }
```

| Field | Meaning |
| --- | --- |
| `question` | What to ask. |
| `expectKeywords` | Words the answer must contain (case-insensitive). Optional. |
| `expectSource` | Part of a source title that must be cited. Optional. |
| `expectNotFound` | `true` if the answer should be "I couldn't find that" with no sources. Optional. |

## Flags

```bash
npm run test:data -- --verbose   # print full answers
npm run test:data -- --keep      # keep the scratch DB at test-data/.scratch/test.db
```

The starter records and questions are examples. Replace them with yours.

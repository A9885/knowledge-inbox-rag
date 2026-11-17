# Answer-model latency (2026-11-18)

Setup: real prompt shape (`SYSTEM_PROMPT` + 3 `<source>` chunks from the seed data: Goa note, Goa article section, gym note),
streaming, `temperature 0`, `max_tokens 700`, OpenAI SDK with the provider base URLs, 5 runs per model, run back to back from
one machine. Question: "What are my plans for the Goa trip?". Times are in ms. Script lives outside the repo (scratchpad).

| Model | Runs ok | First token min / median / max | Total min / median / max |
|-------|---------|--------------------------------|--------------------------|
| NVIDIA `poolside/laguna-xs-2.1` (current default) | 5/5 | 306 / 323 / 582 | 701 / 908 / 9782 |
| Gemini `gemini-3.8-flash` (previous Gemini default) | 0/5 | no token: 4 timeouts at 20 s, 1 HTTP 503 | n/a |
| Gemini `gemini-3.1-flash-lite` | 5/5 | 871 / 1057 / 1189 | 1016 / 1175 / 1319 |
| Gemini `gemini-3.5-flash-lite` | 5/5 | 700 / 1548 / 2747 | 836 / 1747 / 2881 |

Also checked: a plain `say hi` call to `gemini-3.8-flash` timed out at 30 s the same day, while `gemini-3.1-flash-lite` answered in 1.3 s.
So the 3.8-flash result is provider load on the day, not a prompt problem; treat its speed as unknown, not as proof it is slow.

## Quality notes
- laguna-xs-2.1: plain text, cites `[1]`, no empty or reasoning-eaten replies. Sometimes omits the "Suggestions:" block.
- gemini-3.1-flash-lite and 3.5-flash-lite: plain text, cite `[1]`, include 2 suggestions grounded in the sources, no empty replies.
- gemini-3.8-flash: could not be judged (no output).
- One laguna run took 9.8 s in total (first token was fast); the tail is rare but real.

## Decision
Gemini is **not** faster. The best working Gemini model is about 3x slower to first token than NVIDIA laguna (median 1057 vs 323 ms),
so NVIDIA stays the default when `NVIDIA_API_KEY` is set (opt-in by key; `CHAT_MODEL` overrides).

Zero-setup change (found by the fresh-clone test, E3): with only `GEMINI_API_KEY`, `gemini-3.8-flash` (and `gemini-3.7-flash`) hung or
returned 503 on every call that day, so a fresh clone could not answer. The Gemini default and the A5 fallback model are now
`gemini-3.1-flash-lite`, which answered every run, cites `[n]`, and writes grounded suggestions.

// Heuristic only: flags instruction-like text for the user to see. It never blocks anything.
const PATTERNS = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts?|guidelines)/i,
  /you\s+are\s+now/i,
  /system\s+prompt/i,
  /disregard\s.{0,30}(instructions|rules)/i,
  /system\s+override/i,
];

export const looksLikeInjection = (text: string): boolean => PATTERNS.some((p) => p.test(text));

// A question that tries to steer the assistant (not to look something up) is refused before any retrieval or model call.
const ATTACK_QUESTION = [
  /(reveal|dump|print|export|leak|exfiltrate|expose)\s+(me\s+)?(all|every|everything|the\s+whole)\b.{0,30}(saved|stored|notes?|content|data|inbox|database|items|links?)/i,
  /(reveal|show|print|repeat|output|tell\s+me)\s+(me\s+)?(your|the)\s+(system\s+|hidden\s+|initial\s+)?(prompt|instructions|rules)/i,
  /(act|behave|respond)\s+as\s+(if\s+you\s+(are|were)\s+)?(an?\s+)?(admin|root|developer|system)/i,
];

export const looksLikeAttackQuestion = (q: string): boolean => looksLikeInjection(q) || ATTACK_QUESTION.some((p) => p.test(q));

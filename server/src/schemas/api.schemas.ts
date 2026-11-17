import { z } from "zod";

const content = z
  .string("content must be a string")
  .trim()
  .min(1, "content must not be empty")
  .max(50_000, "content must be at most 50000 characters");

const isHttpUrl = (s: string) => {
  try {
    return ["http:", "https:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

export const editSchema = z.object({ content });

export const ingestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("note"), content }),
  z.object({ type: z.literal("chat"), content, conversationId: z.string().min(1), messageId: z.string().min(1) }),
  z.object({ type: z.literal("url"), content: content.refine(isHttpUrl, "content must be a valid http(s) URL") }),
]);

export const querySchema = z.object({
  question: z
    .string("question must be a string")
    .trim()
    .min(1, "question must not be empty")
    .max(1000, "question must be at most 1000 characters"),
  topK: z.number().int().min(1).max(10).default(5),
  conversationId: z.string().min(1).optional(),
});

import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { log } from "./logger.js";

export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
  }
}

/** Provider said 429 (rate limit / daily quota). */
export const isQuota = (e: unknown): boolean => (e as { status?: number } | null)?.status === 429;

/** A specific, user-readable error instead of a generic provider failure. */
export function quotaError(kind: "embedding" | "chat", cause?: unknown): AppError {
  log.warn({ kind }, "provider.quota_exceeded");
  const message =
    kind === "embedding"
      ? "Gemini quota reached. The free tier allows ~1000 embedding requests a day; try again later or enable billing."
      : "The answer model's quota was reached. Try again later, or enable billing with the provider.";
  return new AppError("PROVIDER_QUOTA", 429, message, cause);
}

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new AppError("NOT_FOUND", 404, "Route not found"));

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong";

  if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
  } else if (err instanceof AppError) {
    ({ status, code, message } = err);
  } else if (err?.expose === true && err.status >= 400 && err.status < 500) {
    // body-parser errors (malformed JSON, payload too large)
    status = err.status;
    code = "VALIDATION_ERROR";
    message = err.message;
  } else {
    req.log.error({ err }, "unhandled_error"); // full stack stays in logs only
  }
  res.status(status).json({ error: { code, message, requestId: String(req.id) } });
};

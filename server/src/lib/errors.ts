import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

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

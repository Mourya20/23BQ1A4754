import { logger } from "./logger.js";

export function requestLoggingMiddleware(req, res, next) {
  const start = Date.now();
  logger.request(req);

  res.on("finish", () => {
    logger.response(req, res, Date.now() - start);
  });

  res.on("close", () => {
    if (!res.writableEnded) {
      logger.warn("request aborted by client", {
        method: req.method,
        path: req.originalUrl,
        remoteAddress: req.ip || req.socket.remoteAddress,
      });
    }
  });

  next();
}

export function errorLoggingMiddleware(err, req, res, next) {
  logger.error("unhandled error", {
    message: err?.message,
    stack: err?.stack,
    method: req.method,
    path: req.originalUrl,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({ error: "Internal server error" });
}

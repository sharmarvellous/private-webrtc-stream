import { randomUUID } from "node:crypto";

export function attachRequestContext(logger) {
  return function requestContext(req, res, next) {
    req.requestId = randomUUID();
    req.logger = logger.child({
      component: "http",
      requestId: req.requestId
    });
    res.setHeader("X-Request-Id", req.requestId);
    next();
  };
}

export function requestLogger() {
  return function logRequest(req, res, next) {
    const startedAt = Date.now();

    res.on("finish", () => {
      req.logger?.info("http.request.completed", {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        userId: req.auth?.user?.id ?? null
      });
    });

    next();
  };
}

function serializeErrorResponse(error, isProduction) {
  const statusCode = error.statusCode ?? 500;
  const isOperational = statusCode < 500;

  return {
    statusCode,
    payload: {
      error: {
        message:
          isProduction && !isOperational
            ? "Internal Server Error"
            : error.message || "Internal Server Error",
        details: isProduction && !isOperational ? undefined : error.details
      }
    }
  };
}

export function errorHandler({ logger, isProduction }) {
  return function handleError(error, req, res, _next) {
    const { statusCode, payload } = serializeErrorResponse(error, isProduction);
    const requestLogger = req.logger ?? logger;

    requestLogger.error("http.request.failed", {
      method: req.method,
      path: req.originalUrl,
      statusCode,
      userId: req.auth?.user?.id ?? null,
      errorName: error.name,
      errorMessage: error.message,
      details: error.details,
      stack: isProduction ? undefined : error.stack
    });

    res.status(statusCode).json(payload);
  };
}

import { HttpError } from "../utils/http-error.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function createLoginRateLimiter() {
  const attempts = new Map();

  return function loginRateLimiter(req, _res, next) {
    const now = Date.now();
    const key = req.ip || "unknown";
    const current = attempts.get(key);

    if (!current || current.resetAt <= now) {
      attempts.set(key, {
        count: 1,
        resetAt: now + WINDOW_MS
      });
      return next();
    }

    if (current.count >= MAX_ATTEMPTS) {
      return next(new HttpError(429, "Too many login attempts. Please try again later."));
    }

    current.count += 1;
    attempts.set(key, current);
    return next();
  };
}

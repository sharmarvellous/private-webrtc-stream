import { HttpError } from "../utils/http-error.js";

export function authorizeRole(...roles) {
  return function ensureRole(req, _res, next) {
    if (!req.auth?.user || !roles.includes(req.auth.user.role)) {
      return next(new HttpError(403, "Forbidden for current role"));
    }

    return next();
  };
}

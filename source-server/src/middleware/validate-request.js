import { HttpError } from "../utils/http-error.js";

export function validateRequest(schema, property = "body") {
  return function runValidation(req, _res, next) {
    const parsed = schema.safeParse(req[property]);
    if (!parsed.success) {
      return next(
        new HttpError(400, "Validation failed", {
          issues: parsed.error.issues
        })
      );
    }

    req[property] = parsed.data;
    return next();
  };
}

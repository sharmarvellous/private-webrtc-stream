import { verifyAccessToken } from "../utils/jwt.js";
import { HttpError } from "../utils/http-error.js";

function extractToken(req) {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }

  return null;
}

export function authenticateRequest(userRepository) {
  return async function authenticate(req, _res, next) {
    try {
      const token = extractToken(req);
      if (!token) {
        throw new HttpError(401, "Missing bearer token");
      }

      const payload = verifyAccessToken(token);
      const user = await userRepository.findById(payload.sub);
      if (!user) {
        throw new HttpError(401, "Token user no longer exists");
      }

      req.auth = { token, user };
      next();
    } catch (error) {
      next(error.statusCode ? error : new HttpError(401, "Invalid or expired token"));
    }
  };
}

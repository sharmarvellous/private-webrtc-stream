import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ROLE_VALUES } from "../../../shared/constants/roles.js";

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn
    }
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwtSecret, {
    algorithms: ["HS256"]
  });

  if (
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    !ROLE_VALUES.includes(payload.role)
  ) {
    throw new Error("Invalid token payload");
  }

  return payload;
}

import { verifyAccessToken } from "../utils/jwt.js";

export function createSocketAuthMiddleware({ userRepository }) {
  return async function socketAuth(socket, next) {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        throw new Error("Missing socket token");
      }

      const payload = verifyAccessToken(token);
      const user = await userRepository.findById(payload.sub);
      if (!user) {
        throw new Error("Socket user not found");
      }

      socket.data.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName
      };
      next();
    } catch (error) {
      next(new Error("Unauthorized socket connection"));
    }
  };
}

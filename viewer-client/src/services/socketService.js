import { io } from "socket.io-client";
import { SOURCE_SERVER_URL } from "../api/httpClient.js";

const SOCKET_URL = SOURCE_SERVER_URL;

export function createAuthenticatedSocket(accessToken) {
  return io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
    auth: {
      token: accessToken
    }
  });
}

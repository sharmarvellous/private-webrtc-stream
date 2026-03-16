import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createApp } from "./app.js";
import { createSocketAuthMiddleware } from "./sockets/authenticated-socket.js";
import { registerSignalingHandlers } from "./sockets/signaling.socket.js";

const { app, services, repositories, logger, config } = await createApp();
const server = http.createServer(app);
const allowedOrigins = new Set(config.http.allowedOrigins);

const io = new SocketIOServer(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by Socket.IO CORS`));
    },
    methods: ["GET", "POST"]
  }
});

io.use(createSocketAuthMiddleware({ userRepository: repositories.userRepository }));
registerSignalingHandlers(io, {
  signalingService: services.signalingService,
  logger: logger.child({ component: "signaling-socket" })
});

setInterval(async () => {
  try {
    const expiredIds = await services.sessionService.expireOverdueSessions();
    expiredIds.forEach((sessionId) => {
      io.to(sessionId).emit("session:ended", {
        sessionId,
        reason: "expired_by_ttl"
      });
    });

    if (expiredIds.length > 0) {
      logger.info("session.expiry_sweep_completed", {
        expiredCount: expiredIds.length
      });
    }
  } catch (error) {
    logger.error("session.expiry_sweep_failed", {
      error: error.message
    });
  }
}, 30000).unref();

server.listen(config.http.port, config.http.host, () => {
  logger.info("server.started", {
    host: config.http.host,
    port: config.http.port,
    publicUrl: config.http.publicUrl,
    allowedOrigins: config.http.allowedOrigins
  });
});

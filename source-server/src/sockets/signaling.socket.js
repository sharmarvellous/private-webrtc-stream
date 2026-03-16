import { HttpError } from "../utils/http-error.js";

export function registerSignalingHandlers(io, { signalingService, logger }) {
  function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  io.on("connection", (socket) => {
    logger.info("socket.connected", {
      socketId: socket.id,
      userId: socket.data.user.id,
      role: socket.data.user.role
    });

    socket.on("session:join", async (payload, callback = () => {}) => {
      try {
        if (!isNonEmptyString(payload?.sessionId)) {
          throw new HttpError(400, "A valid sessionId is required");
        }

        if (socket.data.sessionId && socket.data.sessionId !== payload.sessionId) {
          socket.leave(socket.data.sessionId);
          await signalingService.detachSocket(socket.id, socket.data.user);
        }

        await signalingService.authorizeSocketJoin(payload.sessionId, socket.data.user);
        await signalingService.attachSocket(payload.sessionId, socket.data.user, socket.id);
        socket.join(payload.sessionId);
        socket.data.sessionId = payload.sessionId;

        const updatedSession = await signalingService.authorizeSocketJoin(
          payload.sessionId,
          socket.data.user
        );

        callback({
          ok: true,
          session: {
            id: updatedSession.id,
            status: updatedSession.status,
            offer: updatedSession.signaling.offer,
            answer: updatedSession.signaling.answer,
            sourceIceCandidates: updatedSession.signaling.sourceIceCandidates,
            viewerIceCandidates: updatedSession.signaling.viewerIceCandidates
          }
        });

        socket.to(payload.sessionId).emit("peer:joined", {
          sessionId: payload.sessionId,
          userId: socket.data.user.id,
          role: socket.data.user.role
        });
      } catch (error) {
        callback({
          ok: false,
          error: error.message
        });
      }
    });

    socket.on("signal:offer", async (payload, callback = () => {}) => {
      try {
        if (!isNonEmptyString(payload?.sessionId) || !isNonEmptyString(payload?.sdp)) {
          throw new HttpError(400, "A valid sessionId and SDP offer are required");
        }

        const offer = {
          type: "offer",
          sdp: payload.sdp,
          createdAt: new Date().toISOString(),
          createdBy: socket.data.user.id
        };
        await signalingService.storeOffer(payload.sessionId, socket.data.user, socket.id, offer);
        socket.to(payload.sessionId).emit("signal:offer", {
          sessionId: payload.sessionId,
          offer
        });
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, error: error.message });
      }
    });

    socket.on("signal:answer", async (payload, callback = () => {}) => {
      try {
        if (!isNonEmptyString(payload?.sessionId) || !isNonEmptyString(payload?.sdp)) {
          throw new HttpError(400, "A valid sessionId and SDP answer are required");
        }

        const answer = {
          type: "answer",
          sdp: payload.sdp,
          createdAt: new Date().toISOString(),
          createdBy: socket.data.user.id
        };
        await signalingService.storeAnswer(payload.sessionId, socket.data.user, socket.id, answer);
        socket.to(payload.sessionId).emit("signal:answer", {
          sessionId: payload.sessionId,
          answer
        });
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, error: error.message });
      }
    });

    socket.on("signal:ice-candidate", async (payload, callback = () => {}) => {
      try {
        if (!isNonEmptyString(payload?.sessionId) || !payload?.candidate) {
          throw new HttpError(400, "Missing ICE candidate payload");
        }

        const candidate = {
          candidate: payload.candidate,
          createdAt: new Date().toISOString(),
          createdBy: socket.data.user.id
        };
        await signalingService.addIceCandidate(
          payload.sessionId,
          socket.data.user,
          socket.id,
          candidate
        );
        socket.to(payload.sessionId).emit("signal:ice-candidate", {
          sessionId: payload.sessionId,
          candidate
        });
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, error: error.message });
      }
    });

    socket.on("peer:state", (payload) => {
      if (!isNonEmptyString(payload?.sessionId) || !payload?.state) {
        return;
      }

      logger.info("peer.state_reported", {
        sessionId: payload.sessionId,
        userId: socket.data.user.id,
        role: socket.data.user.role,
        state: payload.state
      });
    });

    socket.on("session:end", async (payload, callback = () => {}) => {
      try {
        if (!isNonEmptyString(payload?.sessionId)) {
          throw new HttpError(400, "A valid sessionId is required");
        }

        const session = await signalingService.endSessionFromSocket(
          payload.sessionId,
          socket.data.user,
          socket.id,
          payload.reason ?? "ended_from_socket"
        );
        io.to(payload.sessionId).emit("session:ended", {
          sessionId: payload.sessionId,
          reason: session.endReason
        });
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, error: error.message });
      }
    });

    socket.on("disconnect", async (reason) => {
      logger.info("socket.disconnected", {
        socketId: socket.id,
        userId: socket.data.user.id,
        role: socket.data.user.role,
        reason
      });

      if (socket.data.sessionId) {
        socket.to(socket.data.sessionId).emit("peer:left", {
          sessionId: socket.data.sessionId,
          userId: socket.data.user.id,
          role: socket.data.user.role
        });
      }

      try {
        await signalingService.detachSocket(socket.id, socket.data.user);
      } catch (error) {
        logger.error("socket.disconnect_cleanup_failed", {
          socketId: socket.id,
          userId: socket.data.user?.id,
          error: error.message
        });
      }
    });
  });
}

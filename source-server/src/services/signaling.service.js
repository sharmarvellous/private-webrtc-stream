import { SESSION_STATUSES } from "../../../shared/constants/session-statuses.js";
import { ROLES } from "../../../shared/constants/roles.js";
import { HttpError } from "../utils/http-error.js";

export class SignalingService {
  constructor({ sessionRepository, auditService }) {
    this.sessionRepository = sessionRepository;
    this.auditService = auditService;
  }

  async authorizeSocketJoin(sessionId, user) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    if ([SESSION_STATUSES.ENDED, SESSION_STATUSES.EXPIRED].includes(session.status)) {
      throw new HttpError(410, "Session is closed");
    }

    const isSource = user.role === ROLES.SOURCE && session.sourceOwnerId === user.id;
    const isViewer = user.role === ROLES.VIEWER && session.approvedViewerId === user.id;
    if (!isSource && !isViewer) {
      throw new HttpError(403, "User is not authorized for signaling");
    }

    return session;
  }

  async assertSocketOwnership(sessionId, user, socketId) {
    const session = await this.authorizeSocketJoin(sessionId, user);
    const expectedSocketId =
      user.role === ROLES.SOURCE
        ? session.signaling.sourceSocketId
        : session.signaling.viewerSocketId;

    if (!expectedSocketId || expectedSocketId !== socketId) {
      throw new HttpError(403, "Socket is not attached to this session role");
    }

    return session;
  }

  async attachSocket(sessionId, user, socketId) {
    const updated = await this.sessionRepository.update(sessionId, (session) => {
      if (user.role === ROLES.SOURCE) {
        if (session.signaling.sourceSocketId && session.signaling.sourceSocketId !== socketId) {
          session.signaling.sourceSocketId = null;
        }
        session.signaling.sourceSocketId = socketId;
      }

      if (user.role === ROLES.VIEWER) {
        if (session.signaling.viewerSocketId && session.signaling.viewerSocketId !== socketId) {
          session.signaling.viewerSocketId = null;
        }
        session.signaling.viewerSocketId = socketId;
      }

      session.status =
        session.signaling.sourceSocketId && session.signaling.viewerSocketId
          ? SESSION_STATUSES.ACTIVE
          : SESSION_STATUSES.WAITING;

      return session;
    });

    await this.auditService.log("signaling.session_joined", {
      sessionId,
      userId: user.id,
      role: user.role,
      socketId
    });

    return updated;
  }

  async detachSocket(socketId, user) {
    const sessions = (await this.sessionRepository.listForUser(user)).filter(
      (session) =>
        session.signaling?.sourceSocketId === socketId ||
        session.signaling?.viewerSocketId === socketId
    );

    const updates = [];
    for (const session of sessions) {
      const updated = await this.sessionRepository.update(session.id, (current) => {
        const wasSourceSocket = current.signaling.sourceSocketId === socketId;
        const wasViewerSocket = current.signaling.viewerSocketId === socketId;

        if (current.signaling.sourceSocketId === socketId) {
          current.signaling.sourceSocketId = null;
        }

        if (current.signaling.viewerSocketId === socketId) {
          current.signaling.viewerSocketId = null;
        }

        // Force the next reconnect to negotiate from a fresh signaling state.
        if (wasSourceSocket || wasViewerSocket) {
          current.signaling.offer = null;
          current.signaling.answer = null;
          current.signaling.sourceIceCandidates = [];
          current.signaling.viewerIceCandidates = [];
        }

        if (current.status !== SESSION_STATUSES.ENDED && current.status !== SESSION_STATUSES.EXPIRED) {
          current.status =
            current.signaling.sourceSocketId && current.signaling.viewerSocketId
              ? SESSION_STATUSES.ACTIVE
              : SESSION_STATUSES.WAITING;
        }

        return current;
      });

      updates.push(updated);
      await this.auditService.log("signaling.socket_disconnected", {
        sessionId: session.id,
        userId: user.id,
        role: user.role,
        socketId
      });
    }

    return updates;
  }

  async storeOffer(sessionId, sourceUser, socketId, offer) {
    const session = await this.assertSocketOwnership(sessionId, sourceUser, socketId);
    if (session.sourceOwnerId !== sourceUser.id) {
      throw new HttpError(403, "Only the source can create offers");
    }

    const updated = await this.sessionRepository.update(sessionId, (current) => {
      current.signaling.offer = offer;
      current.signaling.answer = null;
      current.signaling.sourceIceCandidates = [];
      current.signaling.viewerIceCandidates = [];
      return current;
    });

    await this.auditService.log("signaling.offer_stored", {
      sessionId,
      userId: sourceUser.id
    });

    return updated;
  }

  async storeAnswer(sessionId, viewerUser, socketId, answer) {
    const session = await this.assertSocketOwnership(sessionId, viewerUser, socketId);
    if (viewerUser.role !== ROLES.VIEWER || session.approvedViewerId !== viewerUser.id) {
      throw new HttpError(403, "Only the approved viewer can create answers");
    }

    const updated = await this.sessionRepository.update(sessionId, (current) => {
      if (!current.signaling.offer) {
        throw new HttpError(409, "Cannot answer before an offer is available");
      }
      current.signaling.answer = answer;
      return current;
    });

    await this.auditService.log("signaling.answer_stored", {
      sessionId,
      userId: viewerUser.id
    });

    return updated;
  }

  async addIceCandidate(sessionId, user, socketId, candidate) {
    await this.assertSocketOwnership(sessionId, user, socketId);
    const updated = await this.sessionRepository.update(sessionId, (current) => {
      if (user.role === ROLES.VIEWER && current.approvedViewerId !== user.id) {
        throw new HttpError(403, "Only the approved viewer can send viewer ICE candidates");
      }

      if (user.role === ROLES.SOURCE && current.sourceOwnerId !== user.id) {
        throw new HttpError(403, "Only the source owner can send source ICE candidates");
      }

      const bucket =
        user.role === ROLES.SOURCE
          ? current.signaling.sourceIceCandidates
          : current.signaling.viewerIceCandidates;
      bucket.push(candidate);
      return current;
    });

    await this.auditService.log("signaling.ice_candidate_received", {
      sessionId,
      userId: user.id,
      role: user.role
    });

    return updated;
  }

  async endSessionFromSocket(sessionId, user, socketId, reason) {
    const session = await this.assertSocketOwnership(sessionId, user, socketId);
    if (user.role !== ROLES.SOURCE || session.sourceOwnerId !== user.id) {
      throw new HttpError(403, "Only the source can end the session");
    }

    const updated = await this.sessionRepository.update(sessionId, (current) => ({
      ...current,
      status: SESSION_STATUSES.ENDED,
      endedAt: new Date().toISOString(),
      endReason: reason
    }));

    await this.auditService.log("session.ended_from_signaling", {
      sessionId,
      userId: user.id,
      role: user.role,
      reason
    });

    return updated;
  }
}

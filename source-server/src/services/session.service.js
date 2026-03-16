import { v4 as uuidv4 } from "uuid";
import { SESSION_STATUSES } from "../../../shared/constants/session-statuses.js";
import { ROLES } from "../../../shared/constants/roles.js";
import { HttpError } from "../utils/http-error.js";

export class SessionService {
  constructor({
    sessionRepository,
    userRepository,
    videoRepository,
    auditService,
    env,
    webRtcConfig
  }) {
    this.sessionRepository = sessionRepository;
    this.userRepository = userRepository;
    this.videoRepository = videoRepository;
    this.auditService = auditService;
    this.env = env;
    this.webRtcConfig = webRtcConfig;
  }

  get defaultSessionTtlMinutes() {
    return this.env.sessions?.defaultTtlMinutes ?? this.env.sessionDefaultTtlMinutes;
  }

  get maxSessionTtlMinutes() {
    return this.env.sessions?.maxTtlMinutes ?? this.env.sessionMaxTtlMinutes;
  }

  sanitizeSession(session, requester) {
    return {
      id: session.id,
      sourceOwnerId: session.sourceOwnerId,
      approvedViewerId:
        requester.role === ROLES.SOURCE && requester.id === session.sourceOwnerId
          ? session.approvedViewerId
          : session.approvedViewerId === requester.id
            ? session.approvedViewerId
            : null,
      pendingViewerId:
        requester.role === ROLES.SOURCE && requester.id === session.sourceOwnerId
          ? session.pendingViewerId
          : null,
      videoId: session.videoId,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt ?? null,
      endReason: session.endReason ?? null,
      lastOfferAt: session.signaling.offer?.createdAt ?? null,
      lastAnswerAt: session.signaling.answer?.createdAt ?? null,
      canPublish: requester.role === ROLES.SOURCE && requester.id === session.sourceOwnerId,
      canView: requester.role === ROLES.VIEWER && session.approvedViewerId === requester.id,
      webRtcConfig: this.webRtcConfig
    };
  }

  async createSession(sourceUser, { videoId, approvedViewerId, expiresInMinutes }) {
    if (sourceUser.role !== ROLES.SOURCE) {
      throw new HttpError(403, "Only source users can create sessions");
    }

    const video = await this.videoRepository.findById(videoId);
    if (!video || video.ownerUserId !== sourceUser.id) {
      throw new HttpError(404, "Protected video not found for source");
    }

    if (approvedViewerId) {
      const viewer = await this.userRepository.findById(approvedViewerId);
      if (!viewer || viewer.role !== ROLES.VIEWER) {
        throw new HttpError(400, "Approved viewer must be an existing viewer account");
      }
    }

    const requestedTtl = expiresInMinutes ?? this.defaultSessionTtlMinutes;
    const ttlMinutes = Math.min(requestedTtl, this.maxSessionTtlMinutes);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60 * 1000);

    const session = {
      id: uuidv4(),
      sourceOwnerId: sourceUser.id,
      approvedViewerId: approvedViewerId ?? null,
      pendingViewerId: null,
      videoId,
      status: SESSION_STATUSES.CREATED,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      endedAt: null,
      endReason: null,
      signaling: {
        sourceSocketId: null,
        viewerSocketId: null,
        offer: null,
        answer: null,
        sourceIceCandidates: [],
        viewerIceCandidates: []
      }
    };

    await this.sessionRepository.create(session);
    await this.auditService.log("session.created", {
      sessionId: session.id,
      sourceOwnerId: sourceUser.id,
      approvedViewerId: session.approvedViewerId,
      videoId
    });

    return session;
  }

  async listSessionsForUser(user) {
    const sessions = await this.sessionRepository.listForUser(user);
    return sessions.map((session) => this.sanitizeSession(session, user));
  }

  async getSessionForUser(sessionId, user) {
    const session = await this.requireAuthorizedSession(sessionId, user);
    return this.sanitizeSession(session, user);
  }

  async requireAuthorizedSession(sessionId, user) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    const isSourceOwner = session.sourceOwnerId === user.id;
    const isApprovedViewer = session.approvedViewerId === user.id;
    const isPendingViewer = session.pendingViewerId === user.id;
    if (!isSourceOwner && !isApprovedViewer && !isPendingViewer) {
      throw new HttpError(404, "Session not found");
    }

    return session;
  }

  async requestViewerAccess(sessionId, viewerUser) {
    if (viewerUser.role !== ROLES.VIEWER) {
      throw new HttpError(403, "Only viewer users can request access");
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    if ([SESSION_STATUSES.ENDED, SESSION_STATUSES.EXPIRED].includes(session.status)) {
      throw new HttpError(410, "Session is no longer available");
    }

    const nowIso = new Date().toISOString();

    if (session.approvedViewerId && session.approvedViewerId !== viewerUser.id) {
      await this.auditService.log("session.viewer_access_denied", {
        sessionId,
        viewerUserId: viewerUser.id,
        reason: "viewer_not_allowlisted"
      });
      throw new HttpError(403, "Viewer is not authorized for this session");
    }

    if (
      !session.approvedViewerId &&
      session.pendingViewerId &&
      session.pendingViewerId !== viewerUser.id
    ) {
      await this.auditService.log("session.viewer_access_denied", {
        sessionId,
        viewerUserId: viewerUser.id,
        reason: "pending_viewer_already_exists"
      });
      throw new HttpError(409, "Another viewer is already pending approval for this session");
    }

    const updated = await this.sessionRepository.update(sessionId, (current) => ({
      ...current,
      pendingViewerId: viewerUser.id,
      approvedViewerId: current.approvedViewerId ?? null,
      status: SESSION_STATUSES.WAITING,
      viewerRequestedAt: nowIso
    }));

    const autoApproved = updated.approvedViewerId === viewerUser.id;
    await this.auditService.log("session.viewer_access_requested", {
      sessionId,
      viewerUserId: viewerUser.id,
      autoApproved
    });

    return {
      session: this.sanitizeSession(updated, viewerUser),
      accessState: autoApproved ? "approved" : "pending"
    };
  }

  async approveViewer(sessionId, sourceUser, viewerId) {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    if ([SESSION_STATUSES.ENDED, SESSION_STATUSES.EXPIRED].includes(session.status)) {
      throw new HttpError(410, "Session is no longer available");
    }

    if (session.sourceOwnerId !== sourceUser.id) {
      throw new HttpError(403, "Only the session owner can approve viewers");
    }

    if (session.approvedViewerId && session.approvedViewerId !== viewerId) {
      throw new HttpError(409, "This single-viewer session already has a different approved viewer");
    }

    const viewer = await this.userRepository.findById(viewerId);
    if (!viewer || viewer.role !== ROLES.VIEWER) {
      throw new HttpError(400, "Viewer account not found");
    }

    const updated = await this.sessionRepository.update(sessionId, (current) => ({
      ...current,
      approvedViewerId: viewer.id,
      pendingViewerId: viewer.id,
      status: SESSION_STATUSES.WAITING,
      viewerApprovedAt: new Date().toISOString()
    }));

    await this.auditService.log("session.viewer_approved", {
      sessionId,
      sourceOwnerId: sourceUser.id,
      viewerUserId: viewer.id
    });

    return this.sanitizeSession(updated, sourceUser);
  }

  async endSession(sessionId, sourceUser, reason = "ended_by_source") {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new HttpError(404, "Session not found");
    }

    if (session.sourceOwnerId !== sourceUser.id) {
      throw new HttpError(403, "Only the session owner can end the session");
    }

    if ([SESSION_STATUSES.ENDED, SESSION_STATUSES.EXPIRED].includes(session.status)) {
      return this.sanitizeSession(session, sourceUser);
    }

    const updated = await this.sessionRepository.update(sessionId, (current) => ({
      ...current,
      status: SESSION_STATUSES.ENDED,
      endedAt: new Date().toISOString(),
      endReason: reason
    }));

    await this.auditService.log("session.ended", {
      sessionId,
      sourceOwnerId: sourceUser.id,
      reason
    });

    return this.sanitizeSession(updated, sourceUser);
  }

  async expireOverdueSessions() {
    const nowIso = new Date().toISOString();
    const expiredIds = await this.sessionRepository.expireSessions(nowIso);

    await Promise.all(
      expiredIds.map((sessionId) =>
        this.auditService.log("session.expired", {
          sessionId,
          reason: "expired_by_ttl"
        })
      )
    );

    return expiredIds;
  }
}

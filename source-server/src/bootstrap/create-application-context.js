import { appConfig } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { getWebRtcConfig } from "../config/webrtc.js";
import { FileDatabase } from "../utils/file-db.js";
import { UserRepository } from "../repositories/user.repository.js";
import { VideoRepository } from "../repositories/video.repository.js";
import { SessionRepository } from "../repositories/session.repository.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { AuditService } from "../services/audit.service.js";
import { AuthService } from "../services/auth.service.js";
import { SessionService } from "../services/session.service.js";
import { SignalingService } from "../services/signaling.service.js";
import { AuthController } from "../controllers/auth.controller.js";
import { SessionController } from "../controllers/session.controller.js";
import { VideoController } from "../controllers/video.controller.js";
import { authenticateRequest } from "../middleware/authenticate.js";
import { authorizeRole } from "../middleware/authorize-role.js";

export async function createApplicationContext() {
  const logger = createLogger({
    level: appConfig.logging.level,
    baseContext: {
      service: "private-stream-server",
      environment: appConfig.environment.nodeEnv
    }
  });

  const webRtcConfig = getWebRtcConfig();
  const db = new FileDatabase({
    dataFile: appConfig.storage.dataFile,
    seedFile: appConfig.storage.seedFile
  });
  await db.init();

  const repositories = {
    userRepository: new UserRepository(db),
    videoRepository: new VideoRepository(db),
    sessionRepository: new SessionRepository(db),
    auditLogRepository: new AuditLogRepository(db)
  };

  const services = {
    auditService: new AuditService({
      auditLogRepository: repositories.auditLogRepository,
      logger: logger.child({ component: "audit" })
    }),
    authService: null,
    sessionService: null,
    signalingService: null
  };

  services.authService = new AuthService({
    userRepository: repositories.userRepository,
    auditService: services.auditService
  });
  services.sessionService = new SessionService({
    sessionRepository: repositories.sessionRepository,
    userRepository: repositories.userRepository,
    videoRepository: repositories.videoRepository,
    auditService: services.auditService,
    env: appConfig,
    webRtcConfig
  });
  services.signalingService = new SignalingService({
    sessionRepository: repositories.sessionRepository,
    auditService: services.auditService
  });

  const controllers = {
    authController: new AuthController({ authService: services.authService }),
    sessionController: new SessionController({ sessionService: services.sessionService }),
    videoController: new VideoController({ videoRepository: repositories.videoRepository })
  };

  const middleware = {
    authenticate: authenticateRequest(repositories.userRepository),
    authorizeRole
  };

  return {
    config: appConfig,
    logger,
    webRtcConfig,
    repositories,
    services,
    controllers,
    middleware
  };
}

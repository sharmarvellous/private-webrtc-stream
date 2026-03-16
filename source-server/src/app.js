import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { createApplicationContext } from "./bootstrap/create-application-context.js";
import { attachRequestContext, requestLogger } from "./middleware/request-context.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createSessionRouter } from "./routes/session.routes.js";
import { createVideoRouter } from "./routes/video.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";

export async function createApp() {
  const context = await createApplicationContext();
  const { config, logger, webRtcConfig, controllers, middleware, services, repositories } = context;
  const allowedOrigins = new Set(config.http.allowedOrigins);
  const sourceDashboardDist = config.dashboards.sourceDistPath;
  const hasSourceDashboard = fs.existsSync(sourceDashboardDist);

  const app = express();
  app.set("etag", false);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: false
    })
  );
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  app.use(attachRequestContext(logger));
  app.use(requestLogger());

  app.use("/api/health", createHealthRouter({ config, webRtcConfig }));
  app.use(
    "/api/auth",
    createAuthRouter({
      authController: controllers.authController,
      authenticate: middleware.authenticate
    })
  );
  app.use(
    "/api/sessions",
    createSessionRouter({
      sessionController: controllers.sessionController,
      authenticate: middleware.authenticate,
      authorizeRole: middleware.authorizeRole
    })
  );
  app.use(
    "/api/videos",
    createVideoRouter({
      videoController: controllers.videoController,
      authenticate: middleware.authenticate,
      authorizeRole: middleware.authorizeRole
    })
  );
  app.use(
    "/api/protected-videos",
    createVideoRouter({
      videoController: controllers.videoController,
      authenticate: middleware.authenticate,
      authorizeRole: middleware.authorizeRole
    })
  );

  if (hasSourceDashboard) {
    app.use(
      express.static(sourceDashboardDist, {
        index: "index.html",
        extensions: ["html"]
      })
    );

    app.get(["/", "/login", "/source", "/sessions/:sessionId"], (_req, res) => {
      res.sendFile(path.join(sourceDashboardDist, "index.html"));
    });
  } else {
    logger.warn("source_dashboard.dist_missing", {
      sourceDashboardDist
    });
  }

  app.use(
    errorHandler({
      logger,
      isProduction: config.environment.isProduction
    })
  );

  return {
    app,
    services,
    repositories,
    logger,
    config
  };
}

import { Router } from "express";

export function createHealthRouter({ config, webRtcConfig }) {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      status: "ok",
      service: "private-stream-server",
      environment: config.environment.nodeEnv,
      publicUrl: config.http.publicUrl,
      time: new Date().toISOString(),
      webRtc: {
        iceServerCount: webRtcConfig.iceServers.length
      }
    });
  });

  return router;
}

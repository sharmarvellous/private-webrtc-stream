import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { ROLES } from "../../../shared/constants/roles.js";

export function createVideoRouter({ videoController, authenticate, authorizeRole }) {
  const router = Router();

  router.use(authenticate, authorizeRole(ROLES.SOURCE));
  router.get("/", asyncHandler(videoController.listMine));
  router.get("/:videoId/file", asyncHandler(videoController.serveProtectedAsset));
  router.get("/:videoId", asyncHandler(videoController.getById));

  return router;
}

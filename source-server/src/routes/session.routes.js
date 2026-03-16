import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  approveViewerSchema,
  createSessionSchema,
  endSessionSchema
} from "../models/session.schemas.js";
import { ROLES } from "../../../shared/constants/roles.js";

export function createSessionRouter({
  sessionController,
  authenticate,
  authorizeRole
}) {
  const router = Router();

  router.use(authenticate);
  router.get("/", asyncHandler(sessionController.listMine));
  router.get("/:sessionId", asyncHandler(sessionController.getById));

  router.post(
    "/",
    authorizeRole(ROLES.SOURCE),
    validateRequest(createSessionSchema),
    asyncHandler(sessionController.create)
  );

  router.post(
    "/:sessionId/viewer-request",
    authorizeRole(ROLES.VIEWER),
    asyncHandler(sessionController.viewerRequest)
  );

  router.post(
    "/:sessionId/approve-viewer",
    authorizeRole(ROLES.SOURCE),
    validateRequest(approveViewerSchema),
    asyncHandler(sessionController.approveViewer)
  );

  router.post(
    "/:sessionId/end",
    authorizeRole(ROLES.SOURCE),
    validateRequest(endSessionSchema),
    asyncHandler(sessionController.endSession)
  );

  return router;
}

export class SessionController {
  constructor({ sessionService }) {
    this.sessionService = sessionService;
  }

  create = async (req, res) => {
    const session = await this.sessionService.createSession(req.auth.user, req.body);
    res.status(201).json({
      session: this.sessionService.sanitizeSession(session, req.auth.user)
    });
  };

  listMine = async (req, res) => {
    const sessions = await this.sessionService.listSessionsForUser(req.auth.user);
    res.json({ sessions });
  };

  getById = async (req, res) => {
    const session = await this.sessionService.getSessionForUser(req.params.sessionId, req.auth.user);
    res.json({ session });
  };

  viewerRequest = async (req, res) => {
    const result = await this.sessionService.requestViewerAccess(req.params.sessionId, req.auth.user);
    res.json(result);
  };

  approveViewer = async (req, res) => {
    const session = await this.sessionService.approveViewer(
      req.params.sessionId,
      req.auth.user,
      req.body.viewerId
    );
    res.json({ session });
  };

  endSession = async (req, res) => {
    const session = await this.sessionService.endSession(
      req.params.sessionId,
      req.auth.user,
      req.body.reason
    );
    res.json({ session });
  };
}

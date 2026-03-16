export class AuthController {
  constructor({ authService }) {
    this.authService = authService;
  }

  login = async (req, res) => {
    const result = await this.authService.login({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? "unknown"
    });

    res.json(result);
  };

  me = async (req, res) => {
    const { user } = req.auth;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName
      }
    });
  };
}

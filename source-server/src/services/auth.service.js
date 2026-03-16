import { HttpError } from "../utils/http-error.js";
import { verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";

export class AuthService {
  constructor({ userRepository, auditService }) {
    this.userRepository = userRepository;
    this.auditService = auditService;
  }

  async login({ email, password, ipAddress, userAgent }) {
    const user = await this.userRepository.findByEmail(email);
    const isValid = user ? await verifyPassword(password, user.passwordHash) : false;

    await this.auditService.log("auth.login_attempt", {
      userId: user?.id ?? null,
      email,
      success: isValid,
      ipAddress,
      userAgent
    });

    if (!user || !isValid) {
      throw new HttpError(401, "Invalid email or password");
    }

    return {
      accessToken: signAccessToken(user),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName
      }
    };
  }
}

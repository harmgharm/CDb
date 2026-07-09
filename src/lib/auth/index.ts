/**
 * Auth module — public exports
 */

export { logAudit } from "./audit";
export {
  clearAuthCookies,
  getAccessToken,
  getRefreshToken,
  setAccessTokenCookie,
  setAuthCookies,
} from "./cookies";
export { generateInviteCode, markInviteCodeUsed, validateInviteCode } from "./invite";
export { hashPassword, verifyPassword } from "./passwords";
export {
  changePasswordLimiter,
  loginLimiter,
  RateLimiter,
  refreshLimiter,
  signupLimiter,
} from "./rate-limiter";
export {
  createRefreshToken,
  findRefreshToken,
  hashToken,
  isWithinReuseGrace,
  resolveCurrentToken,
  REUSE_GRACE_MS,
  revokeAllUserTokens,
  revokeAndReplaceRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
} from "./refresh-tokens";
export {
  getAdminUser,
  getAuthUser,
  getCurrentUser,
  getModeratorUser,
  isModeratorOrAdmin,
  requireAdmin,
  requireAuth,
  requireModerator,
} from "./session";
export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "./tokens";

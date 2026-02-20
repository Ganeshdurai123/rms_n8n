import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { env } from '../../config/env.js';
import { User, type IUserDocument } from './auth.model.js';
import { RefreshToken } from './refreshToken.model.js';
import { AppError, UnauthorizedError } from '../../shared/errors.js';
import type { Role } from '../../shared/types.js';
import type { RegisterInput } from './auth.schema.js';

// ---- Token generation helper ----

interface TokenPairResult {
  accessToken: string;
  refreshToken: string;
  tokenFamily: string;
}

/**
 * Generate access + refresh token pair.
 * Access token: short-lived, contains sub (userId) and role.
 * Refresh token: long-lived, contains sub, family, jti. Hashed before storage.
 */
async function generateTokenPair(
  userId: string,
  role: Role,
  existingFamily?: string,
): Promise<TokenPairResult> {
  const tokenFamily = existingFamily || nanoid();

  // Access token
  const accessToken = jwt.sign(
    { sub: userId, role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY } as SignOptions,
  );

  // Refresh token with unique jti and family tracking
  const jti = nanoid();
  const refreshToken = jwt.sign(
    { sub: userId, family: tokenFamily, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY } as SignOptions,
  );

  // Hash refresh token before storing (10 rounds - less critical than password)
  const hashedToken = await bcrypt.hash(refreshToken, 10);

  // Calculate expiry date from JWT_REFRESH_EXPIRY
  const expiresAt = new Date();
  const expiryMatch = env.JWT_REFRESH_EXPIRY.match(/^(\d+)([smhd])$/);
  if (expiryMatch) {
    const [, amount, unit] = expiryMatch;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    expiresAt.setTime(
      expiresAt.getTime() + parseInt(amount!, 10) * multipliers[unit!]!,
    );
  } else {
    // Default 7 days if parsing fails
    expiresAt.setTime(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  // Store hashed refresh token in DB
  await RefreshToken.create({
    token: hashedToken,
    userId,
    tokenFamily,
    expiresAt,
  });

  return { accessToken, refreshToken, tokenFamily };
}

/**
 * Strip password and internal fields from user document for API response.
 */
function sanitizeUser(user: IUserDocument) {
  const userObj = user.toObject();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, __v, ...sanitized } = userObj;
  return sanitized;
}

// ---- Public service methods ----

/**
 * Register a new user.
 * Default role: team_member (for self-registration).
 */
export async function register(data: RegisterInput) {
  // Check if email already exists
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  // Create user (password hashed by pre-save hook)
  const user = await User.create({
    email: data.email,
    password: data.password,
    firstName: data.firstName,
    lastName: data.lastName,
    role: 'team_member',
  });

  // Generate token pair
  const { accessToken, refreshToken } = await generateTokenPair(
    user._id.toString(),
    user.role as Role,
  );

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Login with email and password.
 * Same error message for wrong email or wrong password to prevent enumeration.
 */
export async function login(email: string, password: string) {
  // Find user with password field (excluded by default)
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password',
  );

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Compare password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Generate token pair
  const { accessToken, refreshToken } = await generateTokenPair(
    user._id.toString(),
    user.role as Role,
  );

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh access token using a valid refresh token.
 * Implements token rotation with reuse detection:
 * - Verifies the JWT refresh token
 * - Finds matching non-revoked token in the same family
 * - If no match found (replay attack), revokes ALL tokens in the family
 * - If valid: revokes current token, issues new pair in the same family
 */
export async function refreshAccessToken(oldRefreshToken: string) {
  // 1. Verify the refresh token JWT
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(
      oldRefreshToken,
      env.JWT_REFRESH_SECRET,
    ) as jwt.JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const userId = payload.sub as string;
  const tokenFamily = payload.family as string;

  if (!userId || !tokenFamily) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // 2. Find non-revoked tokens in this family
  const storedTokens = await RefreshToken.find({
    userId,
    tokenFamily,
    isRevoked: false,
  });

  // 3. If no non-revoked tokens exist, this is a reuse of a previously-rotated token
  if (storedTokens.length === 0) {
    // REUSE DETECTION: Revoke ALL tokens in this family
    await RefreshToken.updateMany({ tokenFamily }, { isRevoked: true });
    throw new UnauthorizedError(
      'Token reuse detected - please log in again',
    );
  }

  // 4. Find the specific token by comparing hashes
  let matchedToken = null;
  for (const stored of storedTokens) {
    const isMatch = await bcrypt.compare(oldRefreshToken, stored.token);
    if (isMatch) {
      matchedToken = stored;
      break;
    }
  }

  if (!matchedToken) {
    // Token hash doesn't match any stored token - possible reuse of old token
    await RefreshToken.updateMany({ tokenFamily }, { isRevoked: true });
    throw new UnauthorizedError(
      'Token reuse detected - please log in again',
    );
  }

  // 5. Revoke the current token
  matchedToken.isRevoked = true;
  await matchedToken.save();

  // 6. Get user to include role in new token
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // 7. Generate new token pair in the SAME family
  const { accessToken, refreshToken } = await generateTokenPair(
    userId,
    user.role as Role,
    tokenFamily,
  );

  return { accessToken, refreshToken };
}

/**
 * Logout: revoke all tokens in the family.
 * Identity is derived from the refresh token JWT payload (not from req.user),
 * so users with expired access tokens can still log out.
 * Idempotent: does not throw if token is already revoked or invalid.
 */
export async function logout(refreshTokenValue: string): Promise<void> {
  try {
    const payload = jwt.verify(
      refreshTokenValue,
      env.JWT_REFRESH_SECRET,
    ) as jwt.JwtPayload;

    const tokenFamily = payload.family as string;

    if (tokenFamily) {
      // Revoke ALL tokens in this family
      await RefreshToken.updateMany({ tokenFamily }, { isRevoked: true });
    }
  } catch {
    // Logout is idempotent - if token is invalid or expired, just return success
    // This handles the case where the refresh token JWT itself has expired
    // but the user still wants to "log out" (clear cookies)
  }
}

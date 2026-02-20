import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';

/**
 * Cookie settings for refresh token.
 * HttpOnly: prevents XSS token theft.
 * Secure: HTTPS only in production.
 * SameSite strict: prevents CSRF.
 * Path restricted to auth endpoints: only sent to /api/v1/auth.
 */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * POST /api/v1/auth/register
 * Creates a new user, returns access token and sets refresh token cookie.
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await authService.register(
      req.body,
    );

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(201).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 * Validates credentials, returns access token and sets refresh token cookie.
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await authService.login(
      req.body.email,
      req.body.password,
    );

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ user, accessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Extracts refresh token from HttpOnly cookie, rotates tokens.
 * No auth middleware required - uses cookie for identity.
 */
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }

    const { accessToken, refreshToken } =
      await authService.refreshAccessToken(token);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Extracts refresh token from HttpOnly cookie, revokes all tokens in family.
 * No auth middleware required - identity derived from refresh token cookie
 * so users with expired access tokens can still log out.
 * Idempotent: returns 200 even if no cookie present.
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      await authService.logout(token);
    }

    // Always clear the cookie
    res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS);
    res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile.
 * Requires authenticate middleware.
 */
export async function me(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  res.status(200).json({ user: req.user });
}

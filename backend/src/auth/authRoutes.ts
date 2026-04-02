import { Router, type Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { generateSecret, generateURI, verify } from "otplib";
import rateLimit from "express-rate-limit";
import { getUserCount, getDb } from "./userStore";
import { requireAuth } from "./authMiddleware";
import {
  getAdminCredentialResetSecret,
  isBootstrapAllowed,
} from "../config/securityEnv";
import { jwtVerifyOptions } from "./jwtVerifyOptions";

const router = Router();

const MAX_AUTH_USERNAME_LEN = 128;
const MAX_AUTH_PASSWORD_LEN = 512;
const MIN_ADMIN_PASSWORD_LEN = 12;
const MAX_TEMP_JWT_CHARS = 4096;
const MAX_TOTP_CODE_CHARS = 32;

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-prod";
const COOKIE_NAME = "alrusco_session";
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

function normalizeCookieDomain(input: string | undefined): string | undefined {
  const raw = input?.trim();
  if (!raw) return undefined;

  // Host-only local development should not use a dotted domain.
  if (raw === "localhost" || raw.endsWith(".localhost")) {
    return raw;
  }

  return raw.startsWith(".") ? raw : `.${raw}`;
}

const COOKIE_DOMAIN =
  normalizeCookieDomain(process.env.COOKIE_DOMAIN) ||
  // Deterministic fallback for this deployment hostname, even if NODE_ENV is misconfigured.
  ".alrusco.com";
/** Authenticated session length — cookie maxAge and JWT exp must stay aligned. */
const SESSION_MAX_AGE_MS = 30 * 60 * 1000;
const COOKIE_MAX_AGE_MS = SESSION_MAX_AGE_MS;

/** Allowed values for POST /api/auth/extend-session (minutes until new expiry). */
const EXTEND_SESSION_MINUTES = new Set([30, 60, 90, 120]);

function issueSessionCookie(
  res: Response,
  userId: number,
  username: string,
  durationMs: number,
): string {
  const expiresInSec = Math.max(1, Math.floor(durationMs / 1000));
  const sessionToken = jwt.sign(
    { sub: userId, username, stage: "session" },
    JWT_SECRET,
    { expiresIn: expiresInSec, algorithm: "HS256" },
  );
  res.cookie(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    // Strict prevents cross-site top-level GETs from sending the session cookie,
    // which reduces CSRF-style "drive-by" triggering of sensitive endpoints like /apps/:id.
    sameSite: "strict",
    domain: COOKIE_DOMAIN,
    path: "/",
    maxAge: durationMs,
  });
  return sessionToken;
}

function sessionExpiresAtFromToken(token: string): string | null {
  const decoded = jwt.decode(token) as JwtPayload | null;
  if (decoded?.exp == null || typeof decoded.exp !== "number") {
    return null;
  }
  return new Date(decoded.exp * 1000).toISOString();
}

const authAttemptLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? "10"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many auth attempts, please try again later" },
});

const extendSessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.EXTEND_SESSION_RATE_LIMIT_MAX ?? "40"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many session extensions, try again later" },
});

function timingSafeResetSecretEqual(a: string, b: string): boolean {
  const ah = crypto.createHash("sha256").update(a, "utf8").digest();
  const bh = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ah, bh);
}

/**
 * Replace all users with a new admin (new password + new TOTP secret).
 * Enabled only when ADMIN_CREDENTIAL_RESET_SECRET is set in the environment (min 24 chars).
 * Remove the env var after use.
 */
router.post("/reset-admin-credentials", authAttemptLimiter, async (req, res) => {
  const configuredSecret = getAdminCredentialResetSecret();
  if (!configuredSecret) {
    return res.status(404).json({ error: "not found" });
  }

  const { resetSecret, username, password } = req.body as {
    resetSecret?: string;
    username?: string;
    password?: string;
  };

  if (!resetSecret || !username || !password) {
    return res.status(400).json({
      error: "resetSecret, username, and password required",
    });
  }

  if (!timingSafeResetSecretEqual(resetSecret, configuredSecret)) {
    return res.status(404).json({ error: "not found" });
  }

  if (
    username.length > MAX_AUTH_USERNAME_LEN ||
    password.length > MAX_AUTH_PASSWORD_LEN
  ) {
    return res.status(400).json({ error: "invalid input" });
  }

  if (password.length < MIN_ADMIN_PASSWORD_LEN) {
    return res.status(400).json({
      error: `password too short (min ${MIN_ADMIN_PASSWORD_LEN} chars)`,
    });
  }

  const db = await getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const totpSecret = await generateSecret();
  const createdAt = new Date().toISOString();

  try {
    await db.exec("BEGIN");
    await db.run("DELETE FROM users");
    await db.run(
      "INSERT INTO users (username, password_hash, totp_secret, created_at) VALUES (?, ?, ?, ?)",
      username.trim(),
      passwordHash,
      totpSecret,
      createdAt,
    );
    await db.exec("COMMIT");
  } catch (err) {
    await db.exec("ROLLBACK").catch(() => {});
    // eslint-disable-next-line no-console
    console.error("[auth] reset-admin-credentials failed", err);
    return res.status(500).json({ error: "failed to reset credentials" });
  }

  const otpauth = generateURI({
    strategy: "totp",
    issuer: "alrusco",
    label: username.trim(),
    secret: totpSecret,
  });

  return res.json({
    message:
      "Admin credentials reset. Add this otpauth URI to your authenticator app, then sign in with your new username and password.",
    otpauth,
  });
});

router.post("/bootstrap", async (req, res) => {
  if (!isBootstrapAllowed()) {
    return res.status(404).json({ error: "not found" });
  }

  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }
  if (
    username.length > MAX_AUTH_USERNAME_LEN ||
    password.length > MAX_AUTH_PASSWORD_LEN
  ) {
    return res.status(400).json({ error: "invalid input" });
  }

  const count = await getUserCount();
  if (count > 0) {
    return res.status(403).json({ error: "admin already initialized" });
  }

  const db = await getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const secret = await generateSecret();
  const createdAt = new Date().toISOString();

  await db.run(
    "INSERT INTO users (username, password_hash, totp_secret, created_at) VALUES (?, ?, ?, ?)",
    username,
    passwordHash,
    secret,
    createdAt,
  );

  const otpauth = generateURI({
    strategy: "totp",
    issuer: "alrusco",
    label: username,
    secret,
  });

  res.json({
    message: "Admin user created. Configure TOTP using this URI in your authenticator app.",
    otpauth,
  });
});

router.post("/login", authAttemptLimiter, async (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return res.status(400).json({ error: "invalid credentials" });
  }
  if (
    username.length > MAX_AUTH_USERNAME_LEN ||
    password.length > MAX_AUTH_PASSWORD_LEN
  ) {
    return res.status(400).json({ error: "invalid credentials" });
  }

  const db = await getDb();
  const user = await db.get<{
    id: number;
    username: string;
    password_hash: string;
    totp_secret: string | null;
    last_login: string | null;
  }>("SELECT * FROM users WHERE username = ?", username);

  if (!user) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const tempToken = jwt.sign(
    { sub: user.id, username: user.username, stage: "password" },
    JWT_SECRET,
    { expiresIn: "5m", algorithm: "HS256" },
  );

  const needsTotpSetup = !user.totp_secret || !user.last_login;
  let otpauth: string | undefined;

  if (needsTotpSetup) {
    let secret = user.totp_secret;
    if (!secret) {
      secret = await generateSecret();
      await db.run("UPDATE users SET totp_secret = ? WHERE id = ?", [
        secret,
        user.id,
      ]);
    }

    otpauth = generateURI({
      strategy: "totp",
      issuer: "alrusco",
      label: user.username.trim(),
      secret,
    });
  }

  // If `otpauth` is present, the frontend should render a QR code and instruct the user
  // to scan it before entering the 6-digit code.
  res.json({ tempToken, ...(otpauth ? { otpauth } : {}) });
});

router.post("/verify-totp", authAttemptLimiter, async (req, res) => {
  const { tempToken, code } = req.body as {
    tempToken?: string;
    code?: string;
  };

  if (!tempToken || !code) {
    return res.status(400).json({ error: "missing token or code" });
  }
  if (
    tempToken.length > MAX_TEMP_JWT_CHARS ||
    code.length > MAX_TOTP_CODE_CHARS
  ) {
    return res.status(400).json({ error: "invalid input" });
  }

  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET, jwtVerifyOptions) as JwtPayload;
    const payload = decoded as JwtPayload & {
      sub: number;
      username: string;
      stage?: string;
    };

    if (payload.stage !== "password") {
      return res.status(400).json({ error: "invalid token stage" });
    }

    const db = await getDb();
    const user = await db.get<{
      id: number;
      username: string;
      totp_secret: string | null;
    }>("SELECT * FROM users WHERE id = ?", payload.sub);

    if (!user || !user.totp_secret) {
      return res.status(401).json({ error: "invalid user" });
    }

    const valid = await verify({
      strategy: "totp",
      token: code,
      secret: user.totp_secret,
    });

    if (!valid) {
      return res.status(401).json({ error: "invalid code" });
    }

    await db.run("UPDATE users SET last_login = ? WHERE id = ?", [
      new Date().toISOString(),
      user.id,
    ]);

    issueSessionCookie(res, user.id, user.username, COOKIE_MAX_AGE_MS);

    res.json({ ok: true });
  } catch (err) {
    return res.status(401).json({ error: "invalid token" });
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = (req as any).user;
  const token = req.cookies?.[COOKIE_NAME];
  const sessionExpiresAt =
    typeof token === "string" ? sessionExpiresAtFromToken(token) : null;
  res.json({ user, sessionExpiresAt });
});

/**
 * Reverse-proxy auth probe endpoint for app subdomains.
 * Used by Nginx/NPM auth_request to allow/deny upstream access.
 */
router.get("/proxy-check", requireAuth, (_req, res) => {
  res.json({ ok: true });
});

router.post("/extend-session", extendSessionLimiter, requireAuth, (req, res) => {
  const raw = (req.body as { minutes?: unknown })?.minutes;
  const minutes = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(minutes) || !EXTEND_SESSION_MINUTES.has(minutes)) {
    return res.status(400).json({
      error: "minutes must be 30, 60, 90, or 120",
    });
  }

  const user = (req as any).user as { id: number; username: string };
  const durationMs = minutes * 60 * 1000;
  const sessionToken = issueSessionCookie(res, user.id, user.username, durationMs);
  const sessionExpiresAt = sessionExpiresAtFromToken(sessionToken);

  res.json({ ok: true, sessionExpiresAt });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "missing fields" });
  }

  if (newPassword.length < 12) {
    return res.status(400).json({ error: "password too short (min 12 chars)" });
  }

  const db = await getDb();
  const userCtx = (req as any).user as { id: number; username: string };

  const user = await db.get<{
    id: number;
    username: string;
    password_hash: string;
  }>("SELECT id, username, password_hash FROM users WHERE id = ?", userCtx.id);

  if (!user) {
    return res.status(404).json({ error: "user not found" });
  }

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "current password incorrect" });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.run("UPDATE users SET password_hash = ? WHERE id = ?", newHash, user.id);

  return res.json({ ok: true });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "strict",
    domain: COOKIE_DOMAIN,
    path: "/",
  });
  res.json({ ok: true });
});

export default router;


import { Router, type Response } from "express";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";
import { generateSecret, generateURI, verify } from "otplib";
import rateLimit from "express-rate-limit";
import { getUserCount, getDb } from "./userStore";
import { requireAuth } from "./authMiddleware";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-prod";
const COOKIE_NAME = "alrusco_session";
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
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
    { expiresIn: expiresInSec },
  );
  res.cookie(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
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

router.post("/bootstrap", async (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
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

  const db = await getDb();
  const user = await db.get<{
    id: number;
    username: string;
    password_hash: string;
    totp_secret: string | null;
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
    { expiresIn: "5m" },
  );

  res.json({ tempToken });
});

router.post("/verify-totp", authAttemptLimiter, async (req, res) => {
  const { tempToken, code } = req.body as {
    tempToken?: string;
    code?: string;
  };

  if (!tempToken || !code) {
    return res.status(400).json({ error: "missing token or code" });
  }

  try {
    const decoded = jwt.verify(tempToken, JWT_SECRET) as JwtPayload;
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

router.post("/extend-session", requireAuth, (req, res) => {
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
    sameSite: "lax",
  });
  res.json({ ok: true });
});

export default router;


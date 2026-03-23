import { Router } from "express";
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
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

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

    const sessionToken = jwt.sign(
      { sub: user.id, username: user.username, stage: "session" },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.cookie(
      COOKIE_NAME,
      sessionToken,
      {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE_MS,
      },
    );

    res.json({ ok: true });
  } catch (err) {
    return res.status(401).json({ error: "invalid token" });
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = (req as any).user;
  res.json({ user });
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


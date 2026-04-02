import express, { type Request } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import publicRoutes from "./routes/public";
import appsRoutes from "./routes/apps";
import { getDb, getUserCount, initUserStore } from "./auth/userStore";
import authRoutes from "./auth/authRoutes";
import weatherRoutes from "./routes/weather";
import projectsRoutes from "./routes/projects";
import photosRoutes from "./routes/photos";
import homeRoutes from "./routes/home";
import portfolioPublicRoutes from "./routes/portfolioPublic";
import dashboardPublicRoutes from "./routes/dashboardPublic";
import rssPublicRoutes from "./routes/rssPublic";
import marketRoutes from "./routes/market";
import adminProjectsRoutes from "./routes/adminProjects";
import adminPhotosRoutes from "./routes/adminPhotos";
import adminAlbumsRoutes from "./routes/adminAlbums";
import adminHomeRoutes from "./routes/adminHome";
import adminPortfolioRoutes from "./routes/adminPortfolio";
import adminIntegrationsGithubRoutes from "./routes/adminIntegrationsGithub";
import adminIntegrationsRuntimeRoutes from "./routes/adminIntegrationsRuntime";
import adminSecurityBriefRoutes from "./routes/adminSecurityBrief";
import adminDashboardRoutes from "./routes/adminDashboard";
import adminRssRoutes from "./routes/adminRss";
import adminNotesRoutes from "./routes/adminNotes";
import adminAiRoutes from "./routes/adminAi";
import { assertProductionSecurity } from "./config/securityEnv";
import { lanApps } from "./config/lanApps";
import { assertLanAppsInternalUrls } from "./utils/appRedirectAllowlist";
import { getAuthDbPath, getDataDir, getUploadsRoot } from "./utils/dataDir";
import { ensureEncryptionKeyConfigured } from "./services/githubCredentials";

const app = express();
const PORT = process.env.PORT || 3077;
const isProd = process.env.NODE_ENV === "production";

// When running behind a reverse proxy (e.g., Nginx Proxy Manager), Express must trust the proxy
// so req.ip / express-rate-limit can safely use X-Forwarded-For.
// Using `1` means "trust the first proxy hop", which is typical for single NPM instances.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? "1"));
app.disable("x-powered-by");

app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT ?? "512kb",
  }),
);
app.use(cookieParser());
const cspDisabled = process.env.CSP_DISABLE === "true";

app.use(
  helmet({
    contentSecurityPolicy: cspDisabled
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            // wasm-unsafe-eval: required for @lottiefiles/dotlottie-web (WASM player), without full unsafe-eval.
            scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            // RSS cards and other embeds load thumbnails from arbitrary publisher/CDN hosts (`https:`).
            imgSrc: ["'self'", "https:", "data:", "blob:"],
            connectSrc: ["'self'", "https://lottie.host"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            workerSrc: ["'self'", "blob:"],
            manifestSrc: ["'self'"],
          },
        },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    originAgentCluster: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // HSTS is opt-in via ENABLE_HSTS so mis-set NODE_ENV can't silently disable it.
    hsts:
      process.env.ENABLE_HSTS === "true"
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
  }),
);

function shouldSkipGlobalRateLimit(req: Request): boolean {
  const p = req.path;
  if (p === "/api/health" || p === "/api/auth/proxy-check") {
    return true;
  }
  // Cheap static GETs: favicon + Vite build chunks should not burn the API budget during normal browsing.
  if (req.method === "GET") {
    if (p === "/favicon.ico" || p === "/robots.txt") {
      return true;
    }
    if (p.startsWith("/assets/")) {
      return true;
    }
  }
  return false;
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Homelab + forward-auth fan-out can exceed 300/15m quickly when testing multiple tabs/apps.
  max: Number(process.env.GLOBAL_RATE_LIMIT_MAX ?? "1200"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: shouldSkipGlobalRateLimit,
});

app.use(limiter);

// Prevent caches from storing authenticated responses (admin/settings/auth).
app.use((req, res, next) => {
  const p = req.path;
  if (p.startsWith("/api/admin") || p.startsWith("/api/auth")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/photos", photosRoutes);
app.use("/api/rss", rssPublicRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/public/home", homeRoutes);
app.use("/api/public/dashboard", dashboardPublicRoutes);
app.use("/api/public/portfolio", portfolioPublicRoutes);
app.use("/api/admin/projects", adminProjectsRoutes);
app.use("/api/admin/photos", adminPhotosRoutes);
app.use("/api/admin/albums", adminAlbumsRoutes);
app.use("/api/admin/home", adminHomeRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/portfolio", adminPortfolioRoutes);
app.use("/api/admin/integrations/github", adminIntegrationsGithubRoutes);
app.use("/api/admin/integrations/runtime", adminIntegrationsRuntimeRoutes);
app.use("/api/admin/security", adminSecurityBriefRoutes);
app.use("/api/admin/rss", adminRssRoutes);
app.use("/api/admin/notes", adminNotesRoutes);
app.use("/api/admin/ai", adminAiRoutes);
app.use("/apps", appsRoutes);

// Serve uploaded assets (e.g., photos) from the data/uploads directory
const uploadsRoot = getUploadsRoot();
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}
app.use(
  "/uploads",
  (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  },
  express.static(uploadsRoot, {
    maxAge: isProd ? 7 * 24 * 60 * 60 * 1000 : 0,
    setHeaders(res, filePath) {
      const lower = filePath.toLowerCase();
      if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (lower.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      } else if (lower.endsWith(".webp")) {
        res.setHeader("Content-Type", "image/webp");
      } else if (lower.endsWith(".gif")) {
        res.setHeader("Content-Type", "image/gif");
      }
    },
  }),
);

const distPath = path.join(__dirname, "..", "..", "frontend-dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function start() {
  assertProductionSecurity();
  assertLanAppsInternalUrls(lanApps);

  const dataDir = getDataDir();
  const authDbPath = getAuthDbPath();
  const allowAdminEnvInit = process.env.ALLOW_ADMIN_ENV_INIT === "true";

  // eslint-disable-next-line no-console
  console.info(
    `[startup] DATA_DIR=${dataDir} authDb=${authDbPath} ALLOW_ADMIN_ENV_INIT=${allowAdminEnvInit}`,
  );

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  await initUserStore();
  await ensureEncryptionKeyConfigured();

  // If this is a fresh install and you provided env credentials, create an initial admin.
  // We intentionally do NOT set `totp_secret` yet; the first successful login will show a QR
  // and complete enrollment.
  const userCount = await getUserCount();
  if (userCount === 0) {
    if (!allowAdminEnvInit) {
      // eslint-disable-next-line no-console
      console.warn(
        "[auth] Admin env init is disabled. Provide an admin via POST /api/auth/bootstrap (with ALLOW_BOOTSTRAP) or POST /api/auth/reset-admin-credentials.",
      );
      // Continue startup without creating an admin. (Login will fail until an admin exists.)
    }

    const username = process.env.ADMIN_USERNAME?.trim();
    const password = process.env.ADMIN_PASSWORD;

    const MAX_AUTH_USERNAME_LEN = 128;
    const MAX_AUTH_PASSWORD_LEN = 512;
    const MIN_ADMIN_PASSWORD_LEN = 12;

    if (username && password) {
      if (!username || username.length > MAX_AUTH_USERNAME_LEN) {
        throw new Error(
          `ADMIN_USERNAME must be <= ${MAX_AUTH_USERNAME_LEN} characters.`,
        );
      }
      if (password.length > MAX_AUTH_PASSWORD_LEN) {
        throw new Error(
          `ADMIN_PASSWORD must be <= ${MAX_AUTH_PASSWORD_LEN} characters.`,
        );
      }
      if (password.length < MIN_ADMIN_PASSWORD_LEN) {
        throw new Error(
          `ADMIN_PASSWORD must be >= ${MIN_ADMIN_PASSWORD_LEN} characters.`,
        );
      }

      const db = await getDb();
      const passwordHash = await bcrypt.hash(password, 12);
      const createdAt = new Date().toISOString();

      await db.run(
        "INSERT INTO users (username, password_hash, totp_secret, created_at) VALUES (?, ?, ?, ?)",
        username,
        passwordHash,
        null,
        createdAt,
      );

      // eslint-disable-next-line no-console
      console.info(
        `[auth] Initial admin created from ADMIN_USERNAME/ADMIN_PASSWORD. On first sign-in you'll scan a TOTP QR to finish setup.`,
      );
    } else if (username || password) {
      throw new Error(
        "ADMIN_USERNAME and ADMIN_PASSWORD must both be set (or both unset).",
      );
    } else {
      // eslint-disable-next-line no-console
      console.info(
        "[auth] No initial admin env vars provided. Use POST /api/auth/bootstrap (with ALLOW_BOOTSTRAP) or /api/auth/reset-admin-credentials to create an admin.",
      );
    }
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", err);
  process.exit(1);
});


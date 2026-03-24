import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import publicRoutes from "./routes/public";
import appsRoutes from "./routes/apps";
import { initUserStore } from "./auth/userStore";
import authRoutes from "./auth/authRoutes";
import weatherRoutes from "./routes/weather";
import projectsRoutes from "./routes/projects";
import photosRoutes from "./routes/photos";
import homeRoutes from "./routes/home";
import adminProjectsRoutes from "./routes/adminProjects";
import adminPhotosRoutes from "./routes/adminPhotos";
import adminAlbumsRoutes from "./routes/adminAlbums";
import adminHomeRoutes from "./routes/adminHome";
import adminIntegrationsGithubRoutes from "./routes/adminIntegrationsGithub";
import { assertProductionSecurity } from "./config/securityEnv";

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
            // WebGL Earth’s api.js pulls in Google Analytics; allow it or the globe fails to init.
            scriptSrc: [
              "'self'",
              "https://www.webglearth.com",
              "https://www.google-analytics.com",
              "https://www.googletagmanager.com",
            ],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: [
              "'self'",
              "https://cdn.simpleicons.org",
              "https://tile.openstreetmap.org",
              "https://www.google-analytics.com",
              "https://www.googletagmanager.com",
              "data:",
              "blob:",
            ],
            connectSrc: [
              "'self'",
              "https://tile.openstreetmap.org",
              "https://www.google-analytics.com",
              "https://*.google-analytics.com",
              "https://analytics.google.com",
              "https://*.analytics.google.com",
              "https://stats.g.doubleclick.net",
            ],
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
    hsts:
      isProd && process.env.ENABLE_HSTS === "true"
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.GLOBAL_RATE_LIMIT_MAX ?? "300"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health",
});

app.use(limiter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/photos", photosRoutes);
app.use("/api/public/home", homeRoutes);
app.use("/api/admin/projects", adminProjectsRoutes);
app.use("/api/admin/photos", adminPhotosRoutes);
app.use("/api/admin/albums", adminAlbumsRoutes);
app.use("/api/admin/home", adminHomeRoutes);
app.use("/api/admin/integrations/github", adminIntegrationsGithubRoutes);
app.use("/apps", appsRoutes);

// Serve uploaded assets (e.g., photos) from the data/uploads directory
const uploadsRoot = path.join(process.cwd(), "data", "uploads");
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

  if (!fs.existsSync(path.join(process.cwd(), "data"))) {
    fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
  }
  await initUserStore();

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", err);
  process.exit(1);
});


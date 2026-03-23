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

const app = express();
const PORT = process.env.PORT || 3077;
// When running behind a reverse proxy (e.g., Nginx Proxy Manager), Express must trust the proxy
// so req.ip / express-rate-limit can safely use X-Forwarded-For.
// Using `1` means "trust the first proxy hop", which is typical for single NPM instances.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? "1"));

app.use(express.json());
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
app.use("/uploads", express.static(uploadsRoot));

const distPath = path.join(__dirname, "..", "..", "frontend-dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

async function start() {
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


import { Router } from "express";
import rateLimit from "express-rate-limit";
import { lanApps } from "../config/lanApps";
import { requireAuth } from "../auth/authMiddleware";
import { isAllowedLanAppRedirectUrl } from "../utils/appRedirectAllowlist";

const router = Router();

router.use(requireAuth);

const appsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.APPS_RATE_LIMIT_MAX ?? "120"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many app redirects, try again later" },
});

router.get("/:id", appsLimiter, (req, res) => {
  const appId = req.params.id;
  const targetApp = lanApps.find((a) => a.id === appId);

  if (!targetApp) {
    return res.status(404).json({ error: "Unknown app id" });
  }

  if (!isAllowedLanAppRedirectUrl(targetApp.internalUrl)) {
    return res.status(500).json({ error: "App redirect misconfigured" });
  }

  // Sensitive: avoid caches storing internal redirect locations.
  res.setHeader("Cache-Control", "no-store");

  // Redirect the browser directly to the internal app URL.
  // Auth is enforced before this point; the target app handles its own auth.
  return res.redirect(targetApp.internalUrl);
});

export default router;


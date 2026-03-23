import { Router } from "express";
import { lanApps } from "../config/lanApps";
import { requireAuth } from "../auth/authMiddleware";

const router = Router();

router.use(requireAuth);

router.get("/:id", (req, res) => {
  const appId = req.params.id;
  const targetApp = lanApps.find((a) => a.id === appId);

  if (!targetApp) {
    return res.status(404).json({ error: "Unknown app id" });
  }

  // Redirect the browser directly to the internal app URL.
  // Auth is enforced before this point; the target app handles its own auth.
  return res.redirect(targetApp.internalUrl);
});

export default router;


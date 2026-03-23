import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware";
import {
  getGithubIntegrationMasked,
  saveGithubIntegration,
} from "../services/githubCredentials";
import { syncGithubProjects } from "../services/githubProjectsSync";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const integration = await getGithubIntegrationMasked();
    res.json({ integration });
  } catch (err) {
    res.status(500).json({ error: "failed to load integration" });
  }
});

router.put("/", async (req, res) => {
  try {
    const body = req.body as {
      owner?: string;
      ownerKind?: string;
      token?: string | null;
      clearToken?: boolean;
    };

    const ownerKind =
      body.ownerKind === "org" ? "org" : body.ownerKind === "user" ? "user" : undefined;

    await saveGithubIntegration({
      owner: body.owner,
      ownerKind,
      token: body.token,
      clearToken: Boolean(body.clearToken),
    });

    const integration = await getGithubIntegrationMasked();
    res.json({ integration });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to save";
    res.status(400).json({ error: message });
  }
});

router.post("/sync", async (_req, res) => {
  try {
    const result = await syncGithubProjects();
    const integration = await getGithubIntegrationMasked();
    res.json({ ok: true, result, integration });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    res.status(400).json({ error: message });
  }
});

export default router;

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth/authMiddleware";
import { sanitizeTextForDisplay } from "../utils/sanitize";
import { getRuntimeIntegrationsResolved } from "../services/runtimeIntegrations";

const router = Router();
router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX ?? "30"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "too many AI requests, try again later" },
});

router.post("/query", aiLimiter, async (req, res) => {
  const runtime = await getRuntimeIntegrationsResolved();
  if (!runtime.openAiApiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
  }

  const raw = (req.body as any)?.query;
  const query = typeof raw === "string" ? sanitizeTextForDisplay(raw).slice(0, 2000) : "";
  if (!query.trim()) {
    return res.status(400).json({ error: "query required" });
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: runtime.openAiModel,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: query }],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.warn("[ai] upstream error", resp.status, text.slice(0, 400));
      return res.status(502).json({ error: "ai upstream error" });
    }

    const data = (await resp.json()) as any;
    const outputText = typeof data?.output_text === "string" ? data.output_text : "";

    return res.json({ text: outputText });
  } catch (err) {
    return res.status(500).json({ error: "ai request failed" });
  }
});

export default router;


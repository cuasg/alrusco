import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware";
import {
  getRuntimeIntegrationsMasked,
  saveRuntimeIntegrations,
} from "../services/runtimeIntegrations";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const integration = await getRuntimeIntegrationsMasked();
    res.json({ integration });
  } catch {
    res.status(500).json({ error: "failed to load integration settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const body = req.body as {
      marketApiKey?: string | null;
      clearMarketApiKey?: boolean;
      finnhubApiKey?: string | null;
      clearFinnhubApiKey?: boolean;
      openAiApiKey?: string | null;
      clearOpenAiApiKey?: boolean;
      weatherApiKey?: string | null;
      clearWeatherApiKey?: boolean;
      openAiModel?: string;
      marketProvider?: "alpha_vantage" | "finnhub";
      marketCacheTtlMs?: number | null;
      rssMinRefreshMs?: number | null;
      weatherFixedLocation?: boolean | null;
      weatherLat?: string | null;
      weatherLon?: string | null;
      githubSyncExcludeForks?: boolean | null;
      githubSyncExcludeArchived?: boolean | null;
      githubApiUserAgent?: string | null;
    };

    await saveRuntimeIntegrations({
      marketApiKey: body.marketApiKey,
      clearMarketApiKey: Boolean(body.clearMarketApiKey),
      finnhubApiKey: body.finnhubApiKey,
      clearFinnhubApiKey: Boolean(body.clearFinnhubApiKey),
      openAiApiKey: body.openAiApiKey,
      clearOpenAiApiKey: Boolean(body.clearOpenAiApiKey),
      weatherApiKey: body.weatherApiKey,
      clearWeatherApiKey: Boolean(body.clearWeatherApiKey),
      openAiModel: body.openAiModel,
      marketProvider: body.marketProvider,
      marketCacheTtlMs:
        body.marketCacheTtlMs === null || body.marketCacheTtlMs === undefined
          ? body.marketCacheTtlMs
          : Number(body.marketCacheTtlMs),
      rssMinRefreshMs:
        body.rssMinRefreshMs === null || body.rssMinRefreshMs === undefined
          ? body.rssMinRefreshMs
          : Number(body.rssMinRefreshMs),
      weatherFixedLocation:
        body.weatherFixedLocation === null || body.weatherFixedLocation === undefined
          ? body.weatherFixedLocation
          : Boolean(body.weatherFixedLocation),
      weatherLat: body.weatherLat,
      weatherLon: body.weatherLon,
      githubSyncExcludeForks:
        body.githubSyncExcludeForks === null || body.githubSyncExcludeForks === undefined
          ? body.githubSyncExcludeForks
          : Boolean(body.githubSyncExcludeForks),
      githubSyncExcludeArchived:
        body.githubSyncExcludeArchived === null || body.githubSyncExcludeArchived === undefined
          ? body.githubSyncExcludeArchived
          : Boolean(body.githubSyncExcludeArchived),
      githubApiUserAgent: body.githubApiUserAgent,
    });

    const integration = await getRuntimeIntegrationsMasked();
    res.json({ integration });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to save integration settings";
    res.status(400).json({ error: message });
  }
});

export default router;


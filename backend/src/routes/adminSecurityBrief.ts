import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware";
import { getAdminCredentialResetSecret, isBootstrapAllowed } from "../config/securityEnv";
import { isEncryptionConfigured } from "../services/githubCredentials";
import { getDataDir, getAuthDbPath } from "../utils/dataDir";
import { isAllowedLanAppRedirectUrl } from "../utils/appRedirectAllowlist";
import { lanApps } from "../config/lanApps";

const router = Router();
router.use(requireAuth);

function asBoolEnv(name: string): boolean | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  return String(raw).trim() === "true";
}

function asNumEnv(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

router.get("/brief", async (_req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  const trustProxyHops = asNumEnv("TRUST_PROXY_HOPS") ?? 1;
  const cookieSecure = asBoolEnv("COOKIE_SECURE") ?? isProd;
  const cookieDomain = (process.env.COOKIE_DOMAIN ?? ".alrusco.com").trim();
  const cookieSameSite = "strict" as const;

  const hstsEnabled = process.env.ENABLE_HSTS === "true";
  const cspDisabled = process.env.CSP_DISABLE === "true";

  const allowBootstrap = isBootstrapAllowed();
  const allowAdminEnvInit = process.env.ALLOW_ADMIN_ENV_INIT === "true";
  const adminResetEnabled = Boolean(getAdminCredentialResetSecret());

  const globalRateLimitMax = asNumEnv("GLOBAL_RATE_LIMIT_MAX") ?? 1200;
  const authRateLimitMax = asNumEnv("AUTH_RATE_LIMIT_MAX") ?? 10;
  const extendSessionRateLimitMax = asNumEnv("EXTEND_SESSION_RATE_LIMIT_MAX") ?? 40;
  const appsRateLimitMax = asNumEnv("APPS_RATE_LIMIT_MAX") ?? 120;

  const lanHostSuffixes =
    (process.env.LAN_APP_REDIRECT_HOST_SUFFIXES ?? "alrusco.com")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const allowLocalhost = process.env.LAN_APP_REDIRECT_ALLOW_LOCALHOST === "true";
  const lanAppsAllPass = lanApps.every((a) => isAllowedLanAppRedirectUrl(a.internalUrl));

  const encryptionConfigured = isEncryptionConfigured();
  const jwtSecretConfigured = Boolean(
    process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 32,
  );

  // Do not expose secrets or full paths. Return only safe, high-signal indicators.
  const dataDir = getDataDir();
  const authDbPath = getAuthDbPath();
  const dataDirHint = dataDir.split("\\").join("/").split("/").slice(-2).join("/");
  const authDbHint = authDbPath.split("\\").join("/").split("/").slice(-2).join("/");

  type CheckStatus = "pass" | "warn" | "fail";
  type Check = {
    id: string;
    status: CheckStatus;
    title: string;
    detail: string;
    recommendedFix?: string;
  };

  const checks: Check[] = [];

  // Cookie posture
  if (!cookieSecure) {
    checks.push({
      id: "cookie-secure",
      status: "fail",
      title: "Session cookie Secure flag",
      detail: "Session cookie is not marked Secure.",
      recommendedFix:
        "Run behind HTTPS and set COOKIE_SECURE=true (or NODE_ENV=production).",
    });
  } else {
    checks.push({
      id: "cookie-secure",
      status: "pass",
      title: "Session cookie Secure flag",
      detail: "Session cookie is marked Secure.",
    });
  }

  checks.push({
    id: "cookie-samesite",
    status: cookieSameSite === "strict" ? "pass" : "warn",
    title: "Session cookie SameSite",
    detail: `SameSite is "${cookieSameSite}".`,
    recommendedFix:
      cookieSameSite === "strict"
        ? undefined
        : 'Set SameSite to "strict" for maximum CSRF resistance.',
  });

  // HSTS / CSP
  if (isProd && !hstsEnabled) {
    checks.push({
      id: "hsts",
      status: "warn",
      title: "HSTS header",
      detail: "HSTS is not enabled in production.",
      recommendedFix: "Set ENABLE_HSTS=true if this hostname is always served over HTTPS.",
    });
  } else {
    checks.push({
      id: "hsts",
      status: "pass",
      title: "HSTS header",
      detail: hstsEnabled ? "HSTS enabled." : "HSTS not enabled (not production).",
    });
  }

  checks.push({
    id: "csp",
    status: cspDisabled ? "warn" : "pass",
    title: "Content Security Policy",
    detail: cspDisabled ? "CSP is disabled." : "CSP enabled.",
    recommendedFix: cspDisabled ? "Unset CSP_DISABLE (or set to false) in production." : undefined,
  });

  // Trust proxy hops
  checks.push({
    id: "trust-proxy",
    status: trustProxyHops >= 1 ? "pass" : "warn",
    title: "Reverse proxy trust",
    detail: `TRUST_PROXY_HOPS=${trustProxyHops}`,
    recommendedFix:
      trustProxyHops >= 1
        ? undefined
        : "Set TRUST_PROXY_HOPS=1 (or your hop count) when behind a reverse proxy.",
  });

  // Redirect allowlist integrity
  if (!lanAppsAllPass) {
    checks.push({
      id: "lan-redirect-allowlist",
      status: "fail",
      title: "LAN app redirect allowlist",
      detail: "At least one lanApps internalUrl fails the redirect allowlist policy.",
      recommendedFix:
        "Fix lanApps internalUrl(s) to be https in prod and match LAN_APP_REDIRECT_HOST_SUFFIXES.",
    });
  } else {
    checks.push({
      id: "lan-redirect-allowlist",
      status: "pass",
      title: "LAN app redirect allowlist",
      detail: "All lanApps internalUrl entries pass the allowlist policy.",
    });
  }

  if (allowLocalhost && isProd) {
    checks.push({
      id: "lan-allow-localhost",
      status: "warn",
      title: "Localhost redirects",
      detail: "LAN_APP_REDIRECT_ALLOW_LOCALHOST is enabled in production.",
      recommendedFix: "Unset LAN_APP_REDIRECT_ALLOW_LOCALHOST in production.",
    });
  } else {
    checks.push({
      id: "lan-allow-localhost",
      status: "pass",
      title: "Localhost redirects",
      detail: allowLocalhost ? "Enabled (dev)." : "Disabled.",
    });
  }

  // Risky one-time switches
  if (adminResetEnabled) {
    checks.push({
      id: "admin-reset",
      status: "warn",
      title: "Emergency admin reset",
      detail: "ADMIN_CREDENTIAL_RESET_SECRET is set (reset endpoint is enabled).",
      recommendedFix: "Unset ADMIN_CREDENTIAL_RESET_SECRET after completing a reset.",
    });
  } else {
    checks.push({
      id: "admin-reset",
      status: "pass",
      title: "Emergency admin reset",
      detail: "Emergency admin reset is disabled.",
    });
  }

  if (isProd && allowBootstrap) {
    checks.push({
      id: "bootstrap",
      status: "warn",
      title: "Bootstrap endpoint",
      detail: "ALLOW_BOOTSTRAP is enabled in production.",
      recommendedFix: "Unset ALLOW_BOOTSTRAP after initial admin creation.",
    });
  } else {
    checks.push({
      id: "bootstrap",
      status: "pass",
      title: "Bootstrap endpoint",
      detail: allowBootstrap ? "Allowed (dev or explicitly enabled)." : "Disabled.",
    });
  }

  if (allowAdminEnvInit) {
    checks.push({
      id: "admin-env-init",
      status: "warn",
      title: "Env-driven admin init",
      detail: "ALLOW_ADMIN_ENV_INIT is enabled.",
      recommendedFix: "Set ALLOW_ADMIN_ENV_INIT=false (or unset) after first setup.",
    });
  } else {
    checks.push({
      id: "admin-env-init",
      status: "pass",
      title: "Env-driven admin init",
      detail: "Env-driven admin init is disabled.",
    });
  }

  // Secrets posture (presence only)
  checks.push({
    id: "jwt-secret",
    status: jwtSecretConfigured ? "pass" : isProd ? "fail" : "warn",
    title: "JWT secret strength",
    detail: jwtSecretConfigured ? "JWT_SECRET looks configured (>=32 chars)." : "JWT_SECRET is missing/too short.",
    recommendedFix:
      jwtSecretConfigured ? undefined : "Set JWT_SECRET to a strong random value (>=32 chars).",
  });

  checks.push({
    id: "encryption-key",
    status: encryptionConfigured ? "pass" : "warn",
    title: "Credentials encryption key",
    detail: encryptionConfigured
      ? "Encryption key is configured (secrets at rest can be encrypted)."
      : "Encryption key not detected (secrets at rest may not be encrypted).",
    recommendedFix: encryptionConfigured ? undefined : "Ensure the server has generated an encryption key or set CREDENTIALS_ENCRYPTION_KEY.",
  });

  res.json({
    generatedAt: new Date().toISOString(),
    checks,
    env: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      isProd,
    },
    headers: {
      hstsEnabled,
      cspDisabled,
    },
    auth: {
      cookie: {
        name: "alrusco_session",
        secure: cookieSecure,
        sameSite: cookieSameSite,
        domain: cookieDomain,
      },
      trustProxyHops,
      bootstrapAllowed: allowBootstrap,
      adminEnvInitAllowed: allowAdminEnvInit,
      adminResetEnabled,
    },
    rateLimits: {
      globalPer15m: globalRateLimitMax,
      authAttemptsPer10m: authRateLimitMax,
      extendSessionPerHour: extendSessionRateLimitMax,
      appsRedirectsPer10m: appsRateLimitMax,
    },
    redirects: {
      lanAppHostSuffixes: lanHostSuffixes,
      allowLocalhost,
      lanAppsAllPassAllowlist: lanAppsAllPass,
    },
    storage: {
      dataDirHint,
      authDbHint,
    },
    secrets: {
      encryptionConfigured,
      jwtSecretConfigured,
    },
  });
});

export default router;


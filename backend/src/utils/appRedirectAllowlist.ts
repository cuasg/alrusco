import type { LanApp } from "../config/lanApps";

function hostSuffixes(): string[] {
  const raw = process.env.LAN_APP_REDIRECT_HOST_SUFFIXES ?? "alrusco.com";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * URLs used for GET /apps/:id redirects must be https (in production), parseable,
 * and match configured host suffixes (or localhost rules in dev).
 */
export function isAllowedLanAppRedirectUrl(urlString: string): boolean {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    return false;
  }

  const isProd = process.env.NODE_ENV === "production";
  if (isProd && u.protocol !== "https:") {
    return false;
  }
  if (!isProd && u.protocol !== "https:" && u.protocol !== "http:") {
    return false;
  }

  const host = u.hostname.toLowerCase();
  if (!host) {
    return false;
  }

  if (process.env.LAN_APP_REDIRECT_ALLOW_LOCALHOST === "true") {
    if (host === "localhost" || host.endsWith(".localhost")) {
      return true;
    }
  }

  const suffixes = hostSuffixes();
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`));
}

/** Fail fast in production if config would allow an unsafe redirect. */
export function assertLanAppsInternalUrls(apps: LanApp[]): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  for (const a of apps) {
    if (!isAllowedLanAppRedirectUrl(a.internalUrl)) {
      throw new Error(
        `[security] lanApps entry "${a.id}" has disallowed internalUrl for production redirect policy.`,
      );
    }
  }
}

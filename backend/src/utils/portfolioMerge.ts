import { sanitizeTextForDisplay } from "./sanitize";
import {
  FALLBACK_PORTFOLIO,
  PORTFOLIO_SECTION_KEYS,
  type PortfolioSectionKey,
  type PortfolioStored,
} from "./portfolioDefaults";

export function mergeWithFallback(parsed: unknown): PortfolioStored {
  const base: PortfolioStored = {
    displayName: FALLBACK_PORTFOLIO.displayName,
    headshotUrl: FALLBACK_PORTFOLIO.headshotUrl,
    sections: { ...FALLBACK_PORTFOLIO.sections },
  };

  if (!parsed || typeof parsed !== "object") {
    return base;
  }

  const p = parsed as Partial<PortfolioStored>;

  if (typeof p.displayName === "string" && p.displayName.trim()) {
    base.displayName = p.displayName.trim();
  }

  if (p.headshotUrl === null) {
    base.headshotUrl = null;
  } else if (typeof p.headshotUrl === "string") {
    const t = p.headshotUrl.trim();
    base.headshotUrl = t || null;
  }

  if (p.sections && typeof p.sections === "object") {
    const s = p.sections as Partial<Record<PortfolioSectionKey, unknown>>;
    for (const key of PORTFOLIO_SECTION_KEYS) {
      if (typeof s[key] === "string") {
        base.sections[key] = s[key] as string;
      }
    }
  }

  return base;
}

function safeHeadshotUrl(url: string | null): string | null {
  if (url == null || typeof url !== "string") return null;
  const t = url.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t) || t.startsWith("/")) {
    return t.slice(0, 500);
  }
  return null;
}

/** Strip XSS; normalize display name to plain text for safe rendering. */
export function sanitizePortfolioForPublic(data: PortfolioStored): PortfolioStored {
  const plainName = sanitizeTextForDisplay(data.displayName)
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 200);

  const sections = { ...data.sections };
  for (const key of PORTFOLIO_SECTION_KEYS) {
    sections[key] = sanitizeTextForDisplay(sections[key] ?? "");
  }

  return {
    displayName: plainName || FALLBACK_PORTFOLIO.displayName,
    headshotUrl: safeHeadshotUrl(data.headshotUrl),
    sections,
  };
}
